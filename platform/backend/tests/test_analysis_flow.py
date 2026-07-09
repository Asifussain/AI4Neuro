"""End-to-end job loop over the fake Supabase: upload -> process -> result."""

from __future__ import annotations

import io

import numpy as np


def _npy_bytes() -> bytes:
    buf = io.BytesIO()
    # Shape mirrors an EEG trial (seq_len, channels); content is irrelevant to the stub.
    np.save(buf, np.zeros((128, 19), dtype=np.float32))
    return buf.getvalue()


def _upload(client, *, modality="eeg", analysis_type="binary", filename="input.npy", data=None):
    return client.post(
        "/api/v1/analysis",
        data={
            "modality": modality,
            "analysis_type": analysis_type,
            "patient_id": "11111111-1111-1111-1111-111111111111",
            "doctor_id": "22222222-2222-2222-2222-222222222222",
            "uploaded_by_role": "technician",
        },
        files={"file": (filename, data if data is not None else _npy_bytes(), "application/octet-stream")},
    )


def test_eeg_upload_runs_to_completion(client):
    res = _upload(client)
    assert res.status_code == 202
    body = res.json()
    session_id = body["session_id"]
    assert body["status"] == "queued"
    assert body["modality"] == "eeg"

    # Jobs run synchronously in tests, so status should already be terminal.
    status = client.get(f"/api/v1/analysis/{session_id}").json()
    assert status["status"] == "completed"
    assert status["progress_percent"] == 100

    result = client.get(f"/api/v1/analysis/{session_id}/result").json()
    assert result["modality"] == "eeg"
    assert result["prediction"] in {"Normal", "Alzheimer's"}
    assert abs(sum(result["probabilities"].values()) - 1.0) < 1e-6
    assert result["model_version"] == "stub-eeg-v0"

    reports = client.get(f"/api/v1/analysis/{session_id}/reports").json()
    assert reports["session_id"] == session_id  # empty urls in foundation


def test_mri_multiclass_shape(client):
    res = _upload(client, modality="mri", analysis_type="multi-disease", filename="scan.nii.gz")
    assert res.status_code == 202
    session_id = res.json()["session_id"]
    result = client.get(f"/api/v1/analysis/{session_id}/result").json()
    assert result["modality"] == "mri"
    assert set(result["probabilities"].keys()) == {"CN", "MCI", "AD"}


def test_rejects_wrong_extension(client):
    res = _upload(client, modality="eeg", filename="scan.nii.gz")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_file_type"


def test_rejects_unknown_modality(client):
    res = _upload(client, modality="pet", filename="x.npy")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_modality"


def test_status_404_for_unknown_session(client):
    res = client.get("/api/v1/analysis/does-not-exist")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "session_not_found"


def test_retry_conflict_on_completed(client):
    session_id = _upload(client).json()["session_id"]
    # Session is completed; retry should be rejected.
    res = client.post(f"/api/v1/analysis/{session_id}/retry")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "retry_not_allowed"


def test_result_404_before_processing(client, db_service):
    # Create a session directly (no job run) -> result not ready.
    session = db_service.create_session(
        modality="eeg",
        analysis_type="binary",
        original_filename="x.npy",
        patient_id="11111111-1111-1111-1111-111111111111",
    )
    res = client.get(f"/api/v1/analysis/{session['id']}/result")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "result_not_ready"
