"""Backend authorization tests (Phase 5).

Unit-tests the permission matrix and route-level enforcement (403). The existing
suite stays green because the dev-bypass principal is admin; these tests override
`get_current_user` with non-admin principals.
"""

from __future__ import annotations

import io

import numpy as np

from app.api.deps import get_current_user
from app.core.security import Principal
from app.services import permissions


def _npy() -> bytes:
    buf = io.BytesIO()
    np.save(buf, np.zeros((128, 19), dtype=np.float32))
    return buf.getvalue()


# ------------------------------ unit: matrix ------------------------------ #

def test_create_matrix():
    assert permissions.can_create_analysis("admin", "eeg")
    assert permissions.can_create_analysis("technician", "eeg")
    assert permissions.can_create_analysis("radiologist", "mri")
    assert permissions.can_create_analysis("doctor", "mri")
    # technicians don't create MRI; patients create nothing; unknown role → no.
    assert not permissions.can_create_analysis("technician", "mri")
    assert not permissions.can_create_analysis("patient", "eeg")
    assert not permissions.can_create_analysis(None, "eeg")


def test_read_session_care_team_and_admin():
    session = {
        "hospital_id": "h1",
        "uploaded_by": "u1",
        "doctor_id": "d1",
        "radiologist_id": None,
        "technician_id": None,
        "patient_id": "p1",
    }
    assert permissions.can_read_session("anyone", "admin", "hX", session)  # admin
    assert permissions.can_read_session("u1", "technician", "h1", session)  # uploader
    assert permissions.can_read_session("d1", "doctor", "h1", session)      # doctor
    assert permissions.can_read_session("p1", "patient", "h1", session)     # own patient
    assert not permissions.can_read_session("stranger", "doctor", "h1", session)


def test_read_session_hospital_scope():
    session = {"hospital_id": "h1", "uploaded_by": "u1"}
    assert permissions.can_read_session("u1", "doctor", "h1", session)
    assert not permissions.can_read_session("u1", "doctor", "h2", session)  # cross-hospital


def test_retry_excludes_patient():
    session = {"hospital_id": "h1", "patient_id": "p1", "uploaded_by": "p1"}
    assert not permissions.can_retry_session("p1", "patient", "h1", session)


# ---------------------------- route-level: 403 ---------------------------- #

def test_create_forbidden_for_patient(client):
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="patient-1", role="patient", hospital_id="h1", is_dev=False
    )
    res = client.post(
        "/api/v1/analysis",
        data={"modality": "eeg", "analysis_type": "binary", "patient_id": "p"},
        files={"file": ("x.npy", _npy(), "application/octet-stream")},
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "permission_denied"


def test_read_forbidden_for_stranger(client, db_service):
    session = db_service.create_session(
        modality="eeg",
        analysis_type="binary",
        original_filename="x.npy",
        patient_id="p1",
        doctor_id="d1",
        hospital_id="h1",
    )
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="stranger", role="doctor", hospital_id="h1", is_dev=False
    )
    res = client.get(f"/api/v1/analysis/{session['id']}")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "permission_denied"


def test_read_allowed_for_owner(client, db_service):
    session = db_service.create_session(
        modality="eeg",
        analysis_type="binary",
        original_filename="x.npy",
        patient_id="p1",
        doctor_id="d1",
        hospital_id="h1",
    )
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="d1", role="doctor", hospital_id="h1", is_dev=False
    )
    res = client.get(f"/api/v1/analysis/{session['id']}")
    assert res.status_code == 200
