"""Report service.

Merges the two legacy ``pdf_generation/`` packages behind one interface. The
proven fpdf2 renderers are reused as the modality-specific sections; this service
provides the common orchestration (context assembly, artifact→image handling,
PDF upload, URL assembly) once, and dispatches page rendering by modality.

Report generation is **non-fatal**: a failed report is logged and skipped, never
failing the analysis job (matching the legacy "completed with errors" behaviour).
"""

from __future__ import annotations

import base64
import os
from typing import Callable, Protocol

from app.core.config import get_settings
from app.core.logging import get_logger
from app.pipelines.base import PipelineResult
from app.reports.context import build_report_context

logger = get_logger(__name__)


class GeneratedReports:
    def __init__(
        self,
        *,
        patient_pdf_url: str | None = None,
        clinician_pdf_url: str | None = None,
        technical_pdf_url: str | None = None,
        asset_urls: dict | None = None,
    ) -> None:
        self.patient_pdf_url = patient_pdf_url
        self.clinician_pdf_url = clinician_pdf_url
        self.technical_pdf_url = technical_pdf_url
        self.asset_urls = asset_urls or {}


class ReportService(Protocol):
    def generate_reports(
        self, session: dict, result: PipelineResult, uploaded_assets: dict
    ) -> GeneratedReports: ...


class NoopReportService:
    """Generates no reports (used in hermetic tests)."""

    def generate_reports(
        self, session: dict, result: PipelineResult, uploaded_assets: dict
    ) -> GeneratedReports:
        return GeneratedReports(asset_urls=uploaded_assets)


def _artifact_data_uri(result: PipelineResult, key: str) -> str | None:
    """Read a plot artifact file (still local at report time) into a data URI."""
    path = result.artifacts.get(key)
    if not path or not os.path.exists(path):
        return None
    try:
        with open(path, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode("utf-8")
        return f"data:image/png;base64,{b64}"
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not read artifact %s: %s", key, exc)
        return None


class PdfReportService:
    """Generates patient/clinician/technical PDFs and uploads them to storage.

    ``storage`` is any object exposing ``upload_bytes(bucket, path, data,
    content_type) -> url`` (the StorageService).
    """

    def __init__(self, storage) -> None:
        self._storage = storage
        self._settings = get_settings()

    def generate_reports(
        self, session: dict, result: PipelineResult, uploaded_assets: dict
    ) -> GeneratedReports:
        modality = session.get("modality")
        session_id = str(session.get("id"))
        context = build_report_context(session, modality or "")

        try:
            if modality == "eeg":
                pdfs = self._build_eeg(context, result)
            elif modality == "mri":
                pdfs = self._build_mri(context, result, session)
            else:
                logger.warning("No report builder for modality %r", modality)
                return GeneratedReports(asset_urls=uploaded_assets)
        except Exception:  # noqa: BLE001 - report gen must never fail the job
            logger.exception("Report generation failed for session %s", session_id)
            return GeneratedReports(asset_urls=uploaded_assets)

        urls = self._upload_pdfs(session_id, pdfs)
        return GeneratedReports(
            patient_pdf_url=urls.get("patient"),
            clinician_pdf_url=urls.get("clinician"),
            technical_pdf_url=urls.get("technical"),
            asset_urls=uploaded_assets,
        )

    # ------------------------------- EEG -------------------------------- #

    def _build_eeg(self, context: dict, result: PipelineResult) -> dict[str, bytes]:
        from app.reports.eeg import (
            ClinicianPDFReport,
            PatientPDFReport,
            TechnicalPDFReport,
            build_clinician_pdf_report_content,
            build_patient_pdf_report_content,
            build_technical_pdf_report_content,
        )

        context["prediction"] = _eeg_prediction_context(result, context)
        stats = result.metrics.get("eeg_stats")
        similarity = result.similarity
        consistency = result.consistency
        ts = _artifact_data_uri(result, "timeseries_plot_url")
        psd = _artifact_data_uri(result, "psd_plot_url")
        sim = _artifact_data_uri(result, "similarity_plot_url")

        return {
            "technical": _render(
                TechnicalPDFReport, build_technical_pdf_report_content,
                context, stats, similarity, consistency, ts, psd, sim,
            ),
            "clinician": _render(
                ClinicianPDFReport, build_clinician_pdf_report_content,
                context, stats, similarity, consistency, ts, psd, sim,
            ),
            "patient": _render(
                PatientPDFReport, build_patient_pdf_report_content,
                context, similarity, consistency, sim,
            ),
        }

    # ------------------------------- MRI -------------------------------- #

    def _build_mri(
        self, context: dict, result: PipelineResult, session: dict
    ) -> dict[str, bytes]:
        from app.reports.mri import (
            ClinicianPDFReport,
            PatientPDFReport,
            TechnicalPDFReport,
            build_clinician_report,
            build_patient_report,
            build_technical_report,
        )

        ml_results = _mri_ml_results(result, session)
        similarity = result.similarity
        sim = _artifact_data_uri(result, "similarity_plot_url")
        vol = _artifact_data_uri(result, "volume_chart_url")
        conf = _artifact_data_uri(result, "confidence_chart_url")

        return {
            "technical": _render(
                TechnicalPDFReport, build_technical_report,
                context, ml_results, similarity, sim, vol, conf,
            ),
            "clinician": _render(
                ClinicianPDFReport, build_clinician_report,
                context, ml_results, similarity, sim, vol, conf,
            ),
            # Patient report omits the volume chart (matches legacy behaviour).
            "patient": _render(
                PatientPDFReport, build_patient_report,
                context, ml_results, similarity, sim, None,
            ),
        }

    # ------------------------------ upload ------------------------------ #

    def _upload_pdfs(self, session_id: str, pdfs: dict[str, bytes]) -> dict[str, str]:
        urls: dict[str, str] = {}
        bucket = self._settings.reports_bucket
        for report_type, pdf_bytes in pdfs.items():
            if not pdf_bytes:
                continue
            path = f"{session_id}/{report_type}.pdf"
            try:
                urls[report_type] = self._storage.upload_bytes(
                    bucket=bucket, path=path, data=pdf_bytes,
                    content_type="application/pdf",
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed uploading %s report: %s", report_type, exc)
        return urls


def _render(pdf_class, builder: Callable, *args) -> bytes | None:
    """Instantiate a report, run its builder, return PDF bytes (None on failure)."""
    try:
        pdf = pdf_class()
        pdf.alias_nb_pages()
        builder(pdf, *args)
        return bytes(pdf.output())
    except Exception as exc:  # noqa: BLE001 - one bad report must not fail the rest
        logger.warning("Report render failed (%s): %s", getattr(builder, "__name__", "?"), exc)
        return None


def _mri_ml_results(result: PipelineResult, session: dict) -> dict:
    """Reconstruct the legacy ml_results dict the MRI builders expect."""
    m = result.metrics
    return {
        "prediction": result.prediction,
        "confidence": result.confidence,
        "probabilities": result.probabilities,  # dict {class: prob}
        "classes": list(result.probabilities.keys()),
        "brain_volume": m.get("brain_volume"),
        "gm_volume": m.get("gm_volume"),
        "wm_volume": m.get("wm_volume"),
        "csf_volume": m.get("csf_volume"),
        "hippocampal_volume": m.get("hippocampal_volume"),
        "ventricular_volume": m.get("ventricular_volume"),
        "model_version": result.model_version,
        "analysis_type": session.get("analysis_type"),
        "processing_time": _processing_seconds(m.get("processing_time_ms")),
        "used_cat12": m.get("used_cat12"),
    }


def _eeg_prediction_context(result: PipelineResult, context: dict) -> dict:
    """Reconstruct the legacy prediction dict the EEG builders expect."""
    session = context.get("session") or {}
    analysis_type = session.get("analysis_type")
    return {
        "prediction": result.prediction,
        "confidence": result.confidence,
        "probabilities": _ordered_eeg_probabilities(result.probabilities, analysis_type),
        "model_version": result.model_version,
        "analysis_type": analysis_type,
        "created_at": session.get("scan_date") or session.get("session_date"),
        "session_code": session.get("session_code"),
    }


def _ordered_eeg_probabilities(probabilities: dict, analysis_type: str | None) -> list[float]:
    """Return the probability list shape expected by the ported EEG PDFs."""
    if analysis_type == "multiclass":
        labels = ["CN", "MCI", "AD"]
    else:
        labels = ["Normal", "Alzheimer's"]
    return [float(probabilities.get(label, 0.0)) for label in labels]


def _processing_seconds(value: object) -> float:
    if value is None:
        return 0.0
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.0
    # Real MRI returns milliseconds; older/mock paths used seconds.
    if numeric > 1000:
        return round(numeric / 1000, 2)
    return round(numeric, 2)
