"""Unified report generation tests (Phase 4).

MRI reports run off the mock pipeline (no torch needed). EEG reports run off the
real pipeline and skip when torch/checkpoints are unavailable. All assert that
real PDFs (``%PDF`` magic) are produced and uploaded to the reports bucket.
"""

from __future__ import annotations

import os

import numpy as np
import pytest

pytest.importorskip("fpdf")
pytest.importorskip("matplotlib")

from app.core.config import get_settings  # noqa: E402
from app.pipelines.base import AnalysisContext  # noqa: E402
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


def test_mri_reports_generate_and_upload(tmp_path):
    from app.pipelines.mri.runner import run_mri_pipeline

    work = tmp_path / "mri"
    work.mkdir()
    scan = work / "scan.nii.gz"
    scan.write_bytes(b"fake-nifti")
    result = run_mri_pipeline(
        AnalysisContext(
            session_id="sess-mri-report",
            modality="mri",
            analysis_type="multi-disease",
            local_input_path=str(scan),
            original_filename="scan.nii.gz",
            patient_id="p",
        )
    )

    fake = FakeSupabase()
    svc = PdfReportService(StorageService(client=fake))
    reports = svc.generate_reports(
        _session("mri", "multi-disease", "sess-mri-report"), result, {}
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


def test_full_mri_loop_generates_reports(tmp_path):
    from app.pipelines.base import register_pipeline
    from app.pipelines.mri.runner import run_mri_pipeline
    from app.services.database import DatabaseService
    from app.services.orchestrator import run_analysis_job

    register_pipeline("mri", run_mri_pipeline)
    fake = FakeSupabase()
    db = DatabaseService(client=fake)
    storage = StorageService(client=fake)

    session = db.create_session(
        modality="mri",
        analysis_type="multi-disease",
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
