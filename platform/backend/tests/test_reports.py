"""Unified report generation tests (Phase 4).

MRI report tests stub out `ml_runner.run_model` with a canned successful result
(no ConViT checkpoint / torch needed) since the pipeline has no mock fallback —
these tests exercise report rendering, not model inference. EEG reports run off
the real pipeline and skip when torch/checkpoints are unavailable. All assert
that real PDFs (``%PDF`` magic) are produced and uploaded to the reports bucket.
"""

from __future__ import annotations

import os

import numpy as np
import pytest

pytest.importorskip("fpdf")
pytest.importorskip("matplotlib")

from app.core.config import get_settings  # noqa: E402
from app.pipelines.base import AnalysisContext  # noqa: E402
from app.pipelines.base import PipelineResult  # noqa: E402
from app.services.reports import _eeg_prediction_context  # noqa: E402
from app.services.reports import PdfReportService  # noqa: E402
from app.services.storage import StorageService  # noqa: E402
from tests.fake_supabase import FakeSupabase  # noqa: E402


def _session(modality: str, analysis_type: str, sid: str = "sess-report") -> dict:
    return {
        "id": sid,
        "modality": modality,
        "analysis_type": analysis_type,
        "patient_id": "11111111-1111-1111-1111-111111111111",
        "created_at": "2026-01-01T00:00:00+00:00",
    }


def _stored_pdfs(fake: FakeSupabase, sid: str) -> dict[str, bytes]:
    bucket = get_settings().reports_bucket
    files = fake.buckets.get(bucket, {})
    return {k: v for k, v in files.items() if k.startswith(f"{sid}/")}


def _fake_ml_result() -> dict:
    """Canned successful ml_runner.run_model() output for report-generation tests."""
    return {
        "prediction": "MCI",
        "confidence": 0.62,
        "probabilities": [0.19, 0.62, 0.19],
        "classes": ["CN", "MCI", "AD"],
        "brain_volume": 1250.0,
        "gm_volume": 550.0,
        "wm_volume": 480.0,
        "csf_volume": 220.0,
        "hippocampal_volume": 3.6,
        "ventricular_volume": 32.0,
        "processing_time": 1200,
        "analysis_type": "multiclass",
        "used_cat12": False,
        "model_version": "ConViT-v1.0",
        "status": "success",
    }


@pytest.mark.parametrize(
    ("analysis_type", "probs", "expected"),
    [
        ("binary", {"Normal": 0.7, "Alzheimer's": 0.3}, [0.7, 0.3]),
        ("multiclass", {"CN": 0.2, "MCI": 0.5, "AD": 0.3}, [0.2, 0.5, 0.3]),
    ],
)
def test_eeg_report_prediction_context_orders_probabilities(
    analysis_type, probs, expected
):
    result = PipelineResult(
        prediction=max(probs, key=probs.get),
        confidence=max(probs.values()),
        probabilities=probs,
        model_version="test-eeg",
    )
    context = {"session": {"analysis_type": analysis_type, "session_code": "S1"}}

    payload = _eeg_prediction_context(result, context)

    assert payload["prediction"] == result.prediction
    assert payload["probabilities"] == expected
    assert payload["model_version"] == "test-eeg"


@pytest.mark.parametrize(
    ("modality", "analysis_type", "result"),
    [
        (
            "eeg",
            "binary",
            PipelineResult(
                prediction="Normal",
                confidence=0.82,
                probabilities={"Normal": 0.82, "Alzheimer's": 0.18},
                metrics={"eeg_stats": {}},
                model_version="ADFormer-ADSZ-Indep",
            ),
        ),
        (
            "eeg",
            "multiclass",
            PipelineResult(
                prediction="MCI",
                confidence=0.61,
                probabilities={"CN": 0.19, "MCI": 0.61, "AD": 0.2},
                metrics={"eeg_stats": {}},
                model_version="ADFormer-ADFD-Indep",
            ),
        ),
        (
            "mri",
            "binary",
            PipelineResult(
                prediction="CN",
                confidence=0.74,
                probabilities={"CN": 0.74, "AD": 0.26},
                metrics={
                    "brain_volume": 1200,
                    "gm_volume": 620,
                    "wm_volume": 450,
                    "csf_volume": 130,
                    "hippocampal_volume": 7.2,
                    "ventricular_volume": 28,
                    "volume_comparison": {},
                },
                model_version="ConViT-v1.0",
            ),
        ),
        (
            "mri",
            "multiclass",
            PipelineResult(
                prediction="AD",
                confidence=0.68,
                probabilities={"CN": 0.12, "MCI": 0.2, "AD": 0.68},
                metrics={
                    "brain_volume": 1100,
                    "gm_volume": 540,
                    "wm_volume": 430,
                    "csf_volume": 160,
                    "hippocampal_volume": 5.8,
                    "ventricular_volume": 41,
                    "volume_comparison": {},
                },
                model_version="ConViT-v1.0",
            ),
        ),
    ],
)
def test_report_generation_matrix_for_all_analysis_variants(
    modality, analysis_type, result
):
    sid = f"sess-{modality}-{analysis_type}"
    fake = FakeSupabase()
    svc = PdfReportService(StorageService(client=fake))

    reports = svc.generate_reports(_session(modality, analysis_type, sid), result, {})

    assert reports.patient_pdf_url
    assert reports.clinician_pdf_url
    assert reports.technical_pdf_url
    stored = _stored_pdfs(fake, sid)
    assert len(stored) == 3
    assert all(b.startswith(b"%PDF") for b in stored.values())


def test_mri_reports_generate_and_upload(tmp_path, monkeypatch):
    from app.pipelines.mri import ml_runner
    from app.pipelines.mri.runner import run_mri_pipeline

    monkeypatch.setattr(ml_runner, "run_model", lambda *a, **k: _fake_ml_result())

    work = tmp_path / "mri"
    work.mkdir()
    scan = work / "scan.nii.gz"
    scan.write_bytes(b"fake-nifti")
    result = run_mri_pipeline(
        AnalysisContext(
            session_id="sess-mri-report",
            modality="mri",
            analysis_type="multiclass",
            local_input_path=str(scan),
            original_filename="scan.nii.gz",
            patient_id="p",
        )
    )

    fake = FakeSupabase()
    svc = PdfReportService(StorageService(client=fake))
    reports = svc.generate_reports(
        _session("mri", "multiclass", "sess-mri-report"), result, {}
    )

    assert reports.patient_pdf_url and reports.clinician_pdf_url and reports.technical_pdf_url
    stored = _stored_pdfs(fake, "sess-mri-report")
    assert len(stored) == 3
    assert all(b.startswith(b"%PDF") for b in stored.values())


@pytest.mark.skipif(
    not os.path.isdir(get_settings().eeg_checkpoint_root)
    or not os.path.exists(
        os.path.join(get_settings().eeg_siddhi_dir, "Sample", "feature_02.npy")
    ),
    reason="EEG checkpoints/sample unavailable",
)
def test_eeg_reports_generate_and_upload(tmp_path):
    pytest.importorskip("torch")
    pytest.importorskip("dtaidistance")
    from app.pipelines.eeg.runner import run_eeg_pipeline

    work = tmp_path / "eeg"
    work.mkdir()
    sample = os.path.join(get_settings().eeg_siddhi_dir, "Sample", "feature_02.npy")
    inp = work / "input.npy"
    np.save(inp, np.load(sample, allow_pickle=True))
    result = run_eeg_pipeline(
        AnalysisContext(
            session_id="sess-eeg-report",
            modality="eeg",
            analysis_type="binary",
            local_input_path=str(inp),
            original_filename="input.npy",
            patient_id="p",
            options={"channel_index": 0},
        )
    )

    fake = FakeSupabase()
    svc = PdfReportService(StorageService(client=fake))
    reports = svc.generate_reports(
        _session("eeg", "binary", "sess-eeg-report"), result, {}
    )

    stored = _stored_pdfs(fake, "sess-eeg-report")
    assert len(stored) == 3
    assert all(b.startswith(b"%PDF") for b in stored.values())
    assert reports.technical_pdf_url


def test_full_mri_loop_generates_reports(tmp_path, monkeypatch):
    from app.pipelines.base import register_pipeline
    from app.pipelines.mri import ml_runner
    from app.pipelines.mri.runner import run_mri_pipeline
    from app.services.database import DatabaseService
    from app.services.orchestrator import run_analysis_job

    monkeypatch.setattr(ml_runner, "run_model", lambda *a, **k: _fake_ml_result())
    register_pipeline("mri", run_mri_pipeline)
    fake = FakeSupabase()
    db = DatabaseService(client=fake)
    storage = StorageService(client=fake)

    session = db.create_session(
        modality="mri",
        analysis_type="multiclass",
        original_filename="scan.nii.gz",
        patient_id="11111111-1111-1111-1111-111111111111",
    )
    sid = str(session["id"])
    bucket, path = storage.upload_raw_file(
        modality="mri", session_id=sid, filename="scan.nii.gz", data=b"fake-nifti"
    )
    db.set_raw_file(sid, path=path, bucket=bucket)

    # Default orchestrator reports = PdfReportService.
    run_analysis_job(sid, db=db, storage=storage)

    assert db.get_session(sid)["status"] == "completed"
    report_row = db.get_reports(sid)
    assert report_row["patient_pdf_url"]
    assert report_row["clinician_pdf_url"]
    assert report_row["technical_pdf_url"]
