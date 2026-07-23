"""Job orchestrator — the one function that runs an analysis end to end.

This is the durable boundary from the architecture doc (6 / 9 Phase 6): it knows
about sessions, storage, the pipeline *registry*, and reports — but never about
SIDDHI or ConViT directly. Swapping the background backend (ThreadPoolExecutor →
Celery/RQ) does not touch this function.

Every failure path marks the session failed, records a job_event, and cleans up
temp files (doc 6, "Every exception must ...").
"""

from __future__ import annotations

import os
import shutil

from app.core.logging import get_logger
from app.pipelines.base import AnalysisContext, run_pipeline
from app.services.database import DatabaseService
from app.services.error_messages import public_analysis_error
from app.services.reports import PdfReportService, ReportService
from app.services.storage import StorageService, new_temp_dir
from app.schemas.analysis import SessionStatus

logger = get_logger(__name__)


def run_analysis_job(
    session_id: str,
    *,
    db: DatabaseService | None = None,
    storage: StorageService | None = None,
    reports: ReportService | None = None,
) -> None:
    """Process one analysis session to completion (or failure)."""
    db = db or DatabaseService()
    storage = storage or StorageService()
    reports = reports or PdfReportService(storage, db=db)

    work_dir: str | None = None
    try:
        session = db.get_session(session_id)
        if not session:
            logger.error("Job for unknown session %s", session_id)
            return

        db.update_session_stage(
            session_id,
            status=SessionStatus.processing.value,
            stage="saved_upload",
            progress=10,
        )
        db.insert_job_event(session_id, message="Job started", stage="saved_upload")

        # 1) Fetch the raw input to local disk.
        work_dir = new_temp_dir(session_id)
        local_input = storage.download_raw_file(session, dest_dir=work_dir)

        # 2) Run the modality pipeline (framework-independent).
        db.update_session_stage(
            session_id, status=SessionStatus.running_model.value,
            stage="model_inference", progress=50,
        )
        context = AnalysisContext(
            session_id=session_id,
            modality=session["modality"],
            analysis_type=session["analysis_type"],
            local_input_path=local_input,
            original_filename=session.get("original_filename", os.path.basename(local_input)),
            patient_id=str(session.get("patient_id")),
            doctor_id=_str_or_none(session.get("doctor_id")),
            hospital_id=_str_or_none(session.get("hospital_id")),
            radiologist_id=_str_or_none(session.get("radiologist_id")),
            uploaded_by_role=session.get("uploaded_by_role"),
            options=session.get("pipeline_options") or {},
        )
        result = run_pipeline(context)

        # 3) Upload artifacts, fold their URLs into visualizations.
        db.update_session_stage(
            session_id, status=SessionStatus.generating_visualizations.value,
            stage="visualization_generation", progress=75,
        )
        uploaded_assets = storage.upload_artifacts(session_id, result.artifacts)
        visualizations = {**result.visualizations, **uploaded_assets}

        # MRI viewer slices → viewer-slices bucket → visualizations.viewer_slice_urls
        if result.viewer_slices:
            slice_urls = storage.upload_viewer_slices(session_id, result.viewer_slices)
            if slice_urls:
                visualizations["viewer_slice_urls"] = slice_urls

        # AI visual explainability (Grad-CAM overlays + MNI152 reference) →
        # report-assets bucket → visualizations.explainability, so the web
        # viewers can show the same evidence as the PDF.
        if result.explainability:
            web_explain = storage.upload_explainability(session_id, result.explainability)
            if web_explain:
                visualizations["explainability"] = web_explain

        # 4) Persist result.
        db.insert_result(session_id, result, visualizations=visualizations)

        # 5) Reports (no-op until Phase 4).
        db.update_session_stage(
            session_id, status=SessionStatus.generating_reports.value,
            stage="report_generation", progress=90,
        )
        generated = reports.generate_reports(session, result, uploaded_assets)
        db.insert_reports(
            session_id,
            patient_pdf_url=generated.patient_pdf_url,
            clinician_pdf_url=generated.clinician_pdf_url,
            technical_pdf_url=generated.technical_pdf_url,
            asset_urls=generated.asset_urls,
        )

        # 6) Done.
        db.mark_completed(session_id)
        db.insert_job_event(
            session_id, message="Job completed", stage="cleanup",
            metadata={"prediction": result.prediction},
        )
        logger.info("Analysis complete for session %s", session_id)

    except Exception as exc:  # noqa: BLE001 - orchestrator is the top of the job
        logger.exception("Analysis failed for session %s", session_id)
        public_message = public_analysis_error(exc)
        try:
            db.mark_failed(session_id, public_message)
            db.insert_job_event(
                session_id, level="error", message=f"Job failed: {public_message}",
            )
        except Exception:  # pragma: no cover - never mask the original error
            logger.exception("Also failed to record failure for %s", session_id)
    finally:
        if work_dir and os.path.isdir(work_dir):
            shutil.rmtree(work_dir, ignore_errors=True)


def _str_or_none(value: object) -> str | None:
    return str(value) if value is not None else None
