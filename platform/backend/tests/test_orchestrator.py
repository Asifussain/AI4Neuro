"""Direct orchestrator tests: failure handling + status transitions."""

from __future__ import annotations

import numpy as np

from app.pipelines.base import AnalysisContext, PipelineResult, register_pipeline
from app.services.database import DatabaseService
from app.services.orchestrator import run_analysis_job
from app.services.storage import StorageService
from tests.fake_supabase import FakeSupabase


def _seed_session(db: DatabaseService, storage: StorageService, modality="eeg") -> str:
    session = db.create_session(
        modality=modality,
        analysis_type="binary",
        original_filename="input.npy",
        patient_id="11111111-1111-1111-1111-111111111111",
    )
    sid = str(session["id"])
    bucket, path = storage.upload_raw_file(
        modality=modality, session_id=sid, filename="input.npy",
        data=np.zeros((4, 4), dtype=np.float32).tobytes(),
    )
    db.set_raw_file(sid, path=path, bucket=bucket)
    return sid


def test_successful_job_marks_completed():
    fake = FakeSupabase()
    db, storage = DatabaseService(client=fake), StorageService(client=fake)
    register_pipeline(
        "eeg",
        lambda ctx: PipelineResult(
            prediction="Normal", confidence=0.9, probabilities={"Normal": 0.9, "Alzheimer's": 0.1},
            model_version="test",
        ),
    )
    sid = _seed_session(db, storage)
    run_analysis_job(sid, db=db, storage=storage)

    session = db.get_session(sid)
    assert session["status"] == "completed"
    assert session["progress_percent"] == 100
    assert db.get_result(sid)["prediction"] == "Normal"
    # A job_event timeline was written.
    assert any(e["session_id"] == sid for e in fake.tables.get("job_events", []))


def test_pipeline_error_marks_failed():
    fake = FakeSupabase()
    db, storage = DatabaseService(client=fake), StorageService(client=fake)

    def _boom(ctx: AnalysisContext) -> PipelineResult:
        raise RuntimeError("model exploded")

    register_pipeline("eeg", _boom)
    sid = _seed_session(db, storage)
    run_analysis_job(sid, db=db, storage=storage)

    session = db.get_session(sid)
    assert session["status"] == "failed"
    assert "Analysis could not be completed" in (session["error_message"] or "")
    assert any(
        e["level"] == "error" for e in fake.tables.get("job_events", [])
    )
