"""Patient -> assigned-doctor report-access request/approve flow."""

from __future__ import annotations

from app.api.deps import get_current_user
from app.core.security import Principal


def _setup(db_service):
    h = db_service.create_hospital(
        {"hospital_code": "H1", "name": "General Hospital", "address": "1 Main St"}
    )
    doctor = db_service.create_user_profile(
        {
            "id": "doc1", "hospital_id": h["id"], "unique_identifier": "DOC-1",
            "full_name": "Dr. Who", "email": "who@example.com", "phone": "1",
            "role": "doctor", "account_status": "active",
        }
    )
    patient = db_service.create_user_profile(
        {
            "id": "pat1", "hospital_id": h["id"], "unique_identifier": "PAT-1",
            "full_name": "Pat Patient", "email": "pat@example.com", "phone": "1",
            "role": "patient", "account_status": "active",
        }
    )
    db_service.create_doctor_patient_relationship(
        {
            "doctor_id": doctor["id"], "patient_id": patient["id"],
            "hospital_id": h["id"], "relationship_status": "active",
        }
    )
    return h, doctor, patient


def _as(client, principal):
    client.app.dependency_overrides[get_current_user] = lambda: principal


def test_full_request_approve_flow(client, db_service):
    h, doctor, patient = _setup(db_service)
    session = db_service.create_session(
        modality="mri", analysis_type="multiclass", original_filename="s.nii.gz",
        patient_id=patient["id"], doctor_id=doctor["id"], hospital_id=h["id"],
    )
    pat_principal = Principal(user_id=patient["id"], role="patient", hospital_id=h["id"], is_dev=False)
    doc_principal = Principal(user_id=doctor["id"], role="doctor", hospital_id=h["id"], is_dev=False)

    # Patient requests access.
    _as(client, pat_principal)
    res = client.post("/api/v1/hospital/report-access/request")
    assert res.status_code == 201
    assert res.json()["status"] == "pending"

    # Reports are blocked while pending.
    res = client.get(f"/api/v1/analysis/{session['id']}/reports")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "report_access_pending"

    # Doctor sees the pending request.
    _as(client, doc_principal)
    res = client.get("/api/v1/hospital/report-access/pending")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    request_id = items[0]["id"]
    assert items[0]["patient_name"] == "Pat Patient"

    # Doctor approves.
    res = client.post(f"/api/v1/hospital/report-access/{request_id}/approve")
    assert res.status_code == 200
    assert res.json()["status"] == "approved"

    # Patient can now open reports.
    _as(client, pat_principal)
    res = client.get(f"/api/v1/analysis/{session['id']}/reports")
    assert res.status_code == 200


def test_request_without_assigned_doctor_400(client, db_service):
    h = db_service.create_hospital(
        {"hospital_code": "H9", "name": "H9", "address": "x"}
    )
    patient = db_service.create_user_profile(
        {
            "id": "pat9", "hospital_id": h["id"], "unique_identifier": "PAT-9",
            "full_name": "Lonely Pat", "email": "l@example.com", "phone": "1",
            "role": "patient", "account_status": "active",
        }
    )
    _as(client, Principal(user_id=patient["id"], role="patient", hospital_id=h["id"], is_dev=False))
    res = client.post("/api/v1/hospital/report-access/request")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "no_assigned_doctor"


def test_other_doctor_cannot_approve(client, db_service):
    h, doctor, patient = _setup(db_service)
    _as(client, Principal(user_id=patient["id"], role="patient", hospital_id=h["id"], is_dev=False))
    request_id = client.post("/api/v1/hospital/report-access/request").json()["id"]

    _as(client, Principal(user_id="other-doc", role="doctor", hospital_id=h["id"], is_dev=False))
    res = client.post(f"/api/v1/hospital/report-access/{request_id}/approve")
    assert res.status_code == 403
