"""Tests for the session list endpoint and /users/me (Phase 7)."""

from __future__ import annotations

from app.api.deps import get_current_user
from app.core.security import Principal


def _seed(db_service, **overrides):
    base = dict(
        modality="eeg",
        analysis_type="binary",
        original_filename="x.npy",
        patient_id="p1",
        hospital_id="h1",
    )
    base.update(overrides)
    return db_service.create_session(**base)


def test_list_returns_all_for_super_admin(client, db_service):
    _seed(db_service, modality="eeg")
    _seed(db_service, modality="eeg")
    _seed(db_service, modality="mri", analysis_type="multiclass")

    res = client.get("/api/v1/analysis")
    assert res.status_code == 200
    page = res.json()
    assert page["total"] == 3
    assert page["limit"] == 50
    assert page["offset"] == 0
    assert len(page["items"]) == 3

    res = client.get("/api/v1/analysis?modality=mri")
    assert res.status_code == 200
    body = res.json()["items"]
    assert len(body) == 1 and body[0]["modality"] == "mri"


def test_list_analysis_pagination_limit_offset(client, db_service):
    for _ in range(5):
        _seed(db_service, modality="eeg")
    res = client.get("/api/v1/analysis?limit=2&offset=3")
    assert res.status_code == 200
    page = res.json()
    assert page["total"] == 5
    assert page["limit"] == 2
    assert page["offset"] == 3
    assert len(page["items"]) == 2


def test_list_scoped_for_non_admin(client, db_service):
    mine = _seed(db_service, doctor_id="d1", hospital_id="h1")
    _seed(db_service, doctor_id="d2", hospital_id="h1")  # not visible to d1

    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="d1", role="doctor", hospital_id="h1", is_dev=False
    )
    res = client.get("/api/v1/analysis")
    assert res.status_code == 200
    ids = [r["id"] for r in res.json()["items"]]
    assert ids == [str(mine["id"])]


def test_users_me_dev_principal(client):
    res = client.get("/api/v1/users/me")
    assert res.status_code == 200
    body = res.json()
    assert body["role"] == "super_admin"
    assert body["account_status"] == "active"


def test_users_me_surfaces_hospital_and_role_detail(client, db_service):
    """The caller's own /users/me must include hospital_id + hospital_name and
    the role-detail fields, so the profile page shows them instead of
    "Not provided" (regression: hospital_id was dropped)."""
    hospital = db_service.create_hospital(
        {"hospital_code": "H1", "name": "General Hospital", "address": "1 Main St"}
    )
    db_service.create_user_profile(
        {
            "id": "rad1",
            "hospital_id": hospital["id"],
            "unique_identifier": "RAD-1",
            "full_name": "Dr. Rita Radiologist",
            "email": "rita@example.com",
            "phone": "555-0100",
            "role": "radiologist",
            "account_status": "active",
        }
    )
    db_service.create_role_profile(
        "radiologist_profiles",
        {
            "user_id": "rad1",
            "radiologist_license": "RAD-LIC-9",
            "imaging_expertise": "MRI",
            "experience_years": 7,
            "certifications": "Board Certified",
        },
    )

    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="rad1", role="radiologist", hospital_id=hospital["id"], is_dev=False
    )
    res = client.get("/api/v1/users/me")
    assert res.status_code == 200
    body = res.json()
    assert body["hospital_id"] == hospital["id"]
    rp = body["profile"]["roleProfile"]
    assert rp["hospital_name"] == "General Hospital"
    assert rp["radiologist_license"] == "RAD-LIC-9"
    assert rp["imaging_expertise"] == "MRI"
    assert rp["experience_years"] == 7
    assert rp["certifications"] == "Board Certified"


def test_create_radiologist_persists_all_role_fields(client, db_service):
    """Creating a radiologist with the optional detail fields must persist every
    one of them to radiologist_profiles (item 4: created data must sync)."""
    hospital = db_service.create_hospital(
        {"hospital_code": "H2", "name": "City Hospital", "address": "2 Main St"}
    )
    res = client.post(
        "/api/v1/hospital/users",
        json={
            "full_name": "Dr. Ray",
            "email": "ray@example.com",
            "phone": "555-0111",
            "role": "radiologist",
            "unique_identifier": "RAD-2",
            "hospital_id": hospital["id"],
            "license_number": "LIC-42",
            "imaging_expertise": "CT, MRI",
            "qualification_id": 3,
            "experience_years": 12,
            "certifications": "ABR",
        },
    )
    assert res.status_code == 201
    new_id = res.json()["id"]
    profiles = {p["user_id"]: p for p in db_service.list_role_profiles("radiologist_profiles")}
    row = profiles[new_id]
    assert row["radiologist_license"] == "LIC-42"
    assert row["imaging_expertise"] == "CT, MRI"
    assert row["qualification_id"] == 3
    assert row["experience_years"] == 12
    assert row["certifications"] == "ABR"
