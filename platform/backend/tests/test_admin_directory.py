"""Tests for the doctor/patient directory, assignments, and verification endpoints."""

from __future__ import annotations

from app.api.deps import get_current_user
from app.core.security import Principal


def _hospital(db_service, code="H1"):
    return db_service.create_hospital(
        {"hospital_code": code, "name": "General Hospital", "address": "123 Main St"}
    )


def _doctor(db_service, hospital_id, *, name="Dr. A", email="a@example.com"):
    user = db_service.create_user_profile(
        {
            "hospital_id": hospital_id,
            "unique_identifier": f"DOC-{name}",
            "full_name": name,
            "email": email,
            "phone": "555-0100",
            "role": "doctor",
            "account_status": "active",
        }
    )
    db_service.create_role_profile(
        "doctor_profiles",
        {
            "user_id": user["id"],
            "medical_license": "LIC-1",
            "specialization": "Neurology",
            "experience_years": 5,
        },
    )
    return user


def _patient(db_service, hospital_id, *, name="Pat A", email="pat@example.com"):
    user = db_service.create_user_profile(
        {
            "hospital_id": hospital_id,
            "unique_identifier": f"PAT-{name}",
            "full_name": name,
            "email": email,
            "phone": "555-0200",
            "role": "patient",
            "account_status": "active",
        }
    )
    db_service.create_role_profile(
        "patient_profiles", {"user_id": user["id"], "patient_id": "PC-1"}
    )
    return user


def _as_hospital_admin(client, hospital_id):
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id=hospital_id, is_dev=False
    )


def test_list_doctors_merges_profile_detail(client, db_service):
    h1 = _hospital(db_service, "H1")
    _doctor(db_service, h1["id"])
    res = client.get("/api/v1/doctors")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["specialization"] == "Neurology"
    assert body[0]["medical_license"] == "LIC-1"
    assert body[0]["verification_status"] == "pending" or body[0]["verification_status"] is None


def test_list_doctors_scoped_to_own_hospital(client, db_service):
    h1 = _hospital(db_service, "H1")
    h2 = _hospital(db_service, "H2")
    _doctor(db_service, h1["id"], name="Dr. A", email="a@x.com")
    _doctor(db_service, h2["id"], name="Dr. B", email="b@x.com")

    _as_hospital_admin(client, h1["id"])
    res = client.get("/api/v1/doctors")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["hospital_id"] == h1["id"]


def test_list_patients_merges_profile_detail(client, db_service):
    h1 = _hospital(db_service, "H1")
    _patient(db_service, h1["id"])
    res = client.get("/api/v1/patients")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["patient_code"] == "PC-1"


def test_clinical_directory_allowed_for_doctor(client, db_service):
    # Doctors may browse the hospital-scoped patient/doctor pickers (used by the
    # New Analysis flow), but only within their own hospital.
    h1 = _hospital(db_service, "H1")
    h2 = _hospital(db_service, "H2")
    _patient(db_service, h1["id"], name="Mine", email="mine@x.com")
    _patient(db_service, h2["id"], name="Other", email="other@x.com")
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="d1", role="doctor", hospital_id=h1["id"], is_dev=False
    )
    res = client.get("/api/v1/patients")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["hospital_id"] == h1["id"]


def test_clinical_directory_forbidden_for_patient(client, db_service):
    h1 = _hospital(db_service, "H1")
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="p1", role="patient", hospital_id=h1["id"], is_dev=False
    )
    res = client.get("/api/v1/patients")
    assert res.status_code == 403


def test_user_directory_still_forbidden_for_doctor(client, db_service):
    # The admin user directory (/users) stays admin-only even though the
    # clinical pickers were opened up to clinicians.
    h1 = _hospital(db_service, "H1")
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="d1", role="doctor", hospital_id=h1["id"], is_dev=False
    )
    res = client.get("/api/v1/users")
    assert res.status_code == 403


def test_verify_doctor_updates_profile(client, db_service):
    h1 = _hospital(db_service, "H1")
    doctor = _doctor(db_service, h1["id"])

    res = client.post(f"/api/v1/users/{doctor['id']}/verify")
    assert res.status_code == 200
    assert res.json()["verification_status"] == "verified"

    profile = db_service.client.table("doctor_profiles").select("*").eq(
        "user_id", doctor["id"]
    ).maybe_single().execute().data
    assert profile["verification_status"] == "verified"


def test_reject_doctor_by_own_hospital_admin(client, db_service):
    h1 = _hospital(db_service, "H1")
    doctor = _doctor(db_service, h1["id"])

    _as_hospital_admin(client, h1["id"])
    res = client.post(f"/api/v1/users/{doctor['id']}/reject")
    assert res.status_code == 200
    assert res.json()["verification_status"] == "rejected"


def test_verify_forbidden_across_hospitals(client, db_service):
    h1 = _hospital(db_service, "H1")
    h2 = _hospital(db_service, "H2")
    doctor = _doctor(db_service, h1["id"])

    _as_hospital_admin(client, h2["id"])
    res = client.post(f"/api/v1/users/{doctor['id']}/verify")
    assert res.status_code == 403


def test_verify_rejects_non_verifiable_role(client, db_service):
    h1 = _hospital(db_service, "H1")
    admin_user = db_service.create_user_profile(
        {
            "hospital_id": h1["id"],
            "unique_identifier": "HA-1",
            "full_name": "Admin",
            "email": "admin@x.com",
            "phone": "1",
            "role": "admin",
            "account_status": "active",
        }
    )
    res = client.post(f"/api/v1/users/{admin_user['id']}/verify")
    assert res.status_code == 400


def test_list_assignments_with_joined_names(client, db_service):
    h1 = _hospital(db_service, "H1")
    doctor = _doctor(db_service, h1["id"], name="Dr. A", email="a@x.com")
    patient = _patient(db_service, h1["id"], name="Pat A", email="p@x.com")
    db_service.create_doctor_patient_relationship(
        {"doctor_id": doctor["id"], "patient_id": patient["id"], "hospital_id": h1["id"]}
    )

    res = client.get("/api/v1/assignments")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["doctor_name"] == "Dr. A"
    assert body[0]["patient_name"] == "Pat A"


def test_list_assignments_scoped_to_own_hospital(client, db_service):
    h1 = _hospital(db_service, "H1")
    h2 = _hospital(db_service, "H2")
    d1 = _doctor(db_service, h1["id"], name="Dr. A", email="a@x.com")
    p1 = _patient(db_service, h1["id"], name="Pat A", email="p1@x.com")
    d2 = _doctor(db_service, h2["id"], name="Dr. B", email="b@x.com")
    p2 = _patient(db_service, h2["id"], name="Pat B", email="p2@x.com")
    db_service.create_doctor_patient_relationship(
        {"doctor_id": d1["id"], "patient_id": p1["id"], "hospital_id": h1["id"]}
    )
    db_service.create_doctor_patient_relationship(
        {"doctor_id": d2["id"], "patient_id": p2["id"], "hospital_id": h2["id"]}
    )

    _as_hospital_admin(client, h1["id"])
    res = client.get("/api/v1/assignments")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["doctor_name"] == "Dr. A"
