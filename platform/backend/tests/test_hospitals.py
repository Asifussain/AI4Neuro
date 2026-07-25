"""Tests for hospital management and admin user-management endpoints."""

from __future__ import annotations

from app.api.deps import get_current_user
from app.core.security import Principal


def _hospital_payload(code="H1"):
    return {
        "hospital_code": code,
        "name": "General Hospital",
        "address": "123 Main St",
    }


def test_super_admin_can_create_and_list_hospitals(client):
    res = client.post("/api/v1/platform/hospitals", json=_hospital_payload())
    assert res.status_code == 201
    hospital = res.json()
    assert hospital["status"] == "active"

    res = client.get("/api/v1/platform/hospitals")
    assert res.status_code == 200
    page = res.json()
    assert page["total"] == 1
    assert len(page["items"]) == 1


def test_hospital_admin_cannot_create_hospital(client):
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id="h1", is_dev=False
    )
    res = client.post("/api/v1/platform/hospitals", json=_hospital_payload())
    assert res.status_code == 403


def test_hospital_admin_cannot_list_platform_hospitals(client, db_service):
    # /platform/hospitals is super_admin only (route-level require_role guard);
    # a hospital_admin's own-hospital view lives at GET /hospital/analytics
    # and similar hospital-scoped routes instead.
    db_service.create_hospital(_hospital_payload("H1"))
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id="h1", is_dev=False
    )
    res = client.get("/api/v1/platform/hospitals")
    assert res.status_code == 403


def test_deactivate_hospital(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    res = client.post(f"/api/v1/platform/hospitals/{h1['id']}/deactivate")
    assert res.status_code == 200
    assert res.json()["status"] == "inactive"


def test_suspend_then_reactivate_hospital(client, db_service):
    # Replaces the old DELETE soft-delete: explicit /suspend, with /activate
    # as the real way back.
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    res = client.post(f"/api/v1/platform/hospitals/{h1['id']}/suspend")
    assert res.status_code == 200
    assert res.json()["status"] == "suspended"

    res = client.post(f"/api/v1/platform/hospitals/{h1['id']}/activate")
    assert res.status_code == 200
    assert res.json()["status"] == "active"


def _seed_hospital_user(db_service, hospital_id, role="doctor", status="active"):
    return db_service.create_user_profile(
        {
            "hospital_id": hospital_id,
            "unique_identifier": f"{role}-{status}-{hospital_id[:6]}",
            "full_name": f"{role} user",
            "email": f"{role}.{status}.{hospital_id[:6]}@example.com",
            "phone": "555-0000",
            "role": role,
            "account_status": status,
        }
    )


def test_suspend_hospital_cascades_to_users(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    doc = _seed_hospital_user(db_service, h1["id"], "doctor")
    pat = _seed_hospital_user(db_service, h1["id"], "patient")

    res = client.post(f"/api/v1/platform/hospitals/{h1['id']}/suspend")
    assert res.status_code == 200
    assert db_service.get_user_profile(doc["id"])["account_status"] == "suspended"
    assert db_service.get_user_profile(pat["id"])["account_status"] == "suspended"

    # Reactivating the hospital restores its users.
    res = client.post(f"/api/v1/platform/hospitals/{h1['id']}/activate")
    assert res.status_code == 200
    assert db_service.get_user_profile(doc["id"])["account_status"] == "active"
    assert db_service.get_user_profile(pat["id"])["account_status"] == "active"


def test_delete_hospital_hard_removes_hospital_and_users(client, db_service, fake_auth_admin):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    admin = _seed_hospital_user(db_service, h1["id"], "admin")
    doc = _seed_hospital_user(db_service, h1["id"], "doctor")

    res = client.request("DELETE", f"/api/v1/platform/hospitals/{h1['id']}")
    assert res.status_code == 204

    # Hospital is gone from the platform entirely.
    assert db_service.get_hospital(h1["id"]) is None
    assert all(h["id"] != h1["id"] for h in db_service.list_hospitals())

    # Every user under it is hard-deleted (row removed, not just flagged) and
    # their Auth login accounts are removed too.
    assert db_service.get_user_profile(admin["id"]) is None
    assert db_service.get_user_profile(doc["id"]) is None
    assert admin["id"] in fake_auth_admin.deleted
    assert doc["id"] in fake_auth_admin.deleted


def test_delete_hospital_leaves_other_hospitals_untouched(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    h2 = db_service.create_hospital(_hospital_payload("H2"))
    keep = _seed_hospital_user(db_service, h2["id"], "doctor")

    res = client.request("DELETE", f"/api/v1/platform/hospitals/{h1['id']}")
    assert res.status_code == 204

    assert db_service.get_hospital(h2["id"]) is not None
    assert db_service.get_user_profile(keep["id"]) is not None


def test_delete_hospital_forbidden_for_hospital_admin(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id=h1["id"], is_dev=False
    )
    res = client.request("DELETE", f"/api/v1/platform/hospitals/{h1['id']}")
    assert res.status_code == 403


def test_hospital_admin_creates_doctor_in_own_hospital(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id=h1["id"], is_dev=False
    )
    res = client.post(
        "/api/v1/hospital/users",
        json={
            "full_name": "Dr. Smith",
            "email": "smith@example.com",
            "phone": "555-0100",
            "role": "doctor",
            "unique_identifier": "DOC-1",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["role"] == "doctor"
    assert body["hospital_id"] == h1["id"]
    assert body["temporary_password"]


def test_hospital_admin_cannot_create_super_admin(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id=h1["id"], is_dev=False
    )
    res = client.post(
        "/api/v1/hospital/users",
        json={
            "full_name": "Rogue",
            "email": "rogue@example.com",
            "phone": "555-0101",
            "role": "super_admin",
            "unique_identifier": "SA-1",
        },
    )
    assert res.status_code == 403


def test_hospital_admin_cannot_create_admin_via_platform_users(client, db_service):
    # POST /platform/users is super_admin-only at the route-registration
    # level (require_role dependency) — a hospital_admin never even reaches
    # the permission-predicate check.
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id=h1["id"], is_dev=False
    )
    res = client.post(
        "/api/v1/platform/users",
        json={
            "full_name": "Rogue Admin",
            "email": "rogueadmin@example.com",
            "phone": "555-0102",
            "role": "admin",
            "unique_identifier": "HA-2",
            "hospital_id": h1["id"],
        },
    )
    assert res.status_code == 403


def test_super_admin_creates_admin_via_platform_users(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    res = client.post(
        "/api/v1/platform/users",
        json={
            "full_name": "New Admin",
            "email": "newadmin@example.com",
            "phone": "555-0103",
            "role": "admin",
            "unique_identifier": "HA-3",
            "hospital_id": h1["id"],
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["role"] == "admin"
    assert body["temporary_password"]


def test_hospital_admin_cannot_list_other_hospital_users(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    h2 = db_service.create_hospital(_hospital_payload("H2"))
    db_service.create_user_profile(
        {
            "hospital_id": h1["id"],
            "unique_identifier": "DOC-1",
            "full_name": "Dr. A",
            "email": "a@example.com",
            "phone": "1",
            "role": "doctor",
            "account_status": "active",
        }
    )
    db_service.create_user_profile(
        {
            "hospital_id": h2["id"],
            "unique_identifier": "DOC-2",
            "full_name": "Dr. B",
            "email": "b@example.com",
            "phone": "2",
            "role": "doctor",
            "account_status": "active",
        }
    )
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id=h1["id"], is_dev=False
    )
    res = client.get("/api/v1/hospital/users")
    assert res.status_code == 200
    page = res.json()
    assert page["total"] == 1
    body = page["items"]
    assert len(body) == 1
    assert body[0]["hospital_id"] == h1["id"]


def test_platform_analytics_super_admin_only(client, db_service):
    res = client.get("/api/v1/platform/analytics")
    assert res.status_code == 200

    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id="h1", is_dev=False
    )
    res = client.get("/api/v1/platform/analytics")
    assert res.status_code == 403


def test_platform_users_list_paginated_envelope(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    for i in range(3):
        db_service.create_user_profile(
            {
                "hospital_id": h1["id"],
                "unique_identifier": f"DOC-{i}",
                "full_name": f"Dr. {i}",
                "email": f"doc{i}@example.com",
                "phone": "1",
                "role": "doctor",
                "account_status": "active",
            }
        )
    res = client.get("/api/v1/platform/users?limit=2&offset=1")
    assert res.status_code == 200
    page = res.json()
    assert page["total"] == 3
    assert page["limit"] == 2
    assert page["offset"] == 1
    assert len(page["items"]) == 2


def test_platform_scans_enriches_names(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    doc = db_service.create_user_profile(
        {
            "id": "doc1", "hospital_id": h1["id"], "unique_identifier": "DOC-1",
            "full_name": "Dr. Who", "email": "who@example.com", "phone": "1",
            "role": "doctor", "account_status": "active",
        }
    )
    pat = db_service.create_user_profile(
        {
            "id": "pat1", "hospital_id": h1["id"], "unique_identifier": "PAT-1",
            "full_name": "Pat Patient", "email": "pat@example.com", "phone": "1",
            "role": "patient", "account_status": "active",
        }
    )
    db_service.create_session(
        modality="mri", analysis_type="multiclass", original_filename="x.nii.gz",
        patient_id=pat["id"], doctor_id=doc["id"], hospital_id=h1["id"],
    )

    res = client.get("/api/v1/platform/scans")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    row = items[0]
    assert row["modality"] == "mri"
    assert row["patient_name"] == "Pat Patient"
    assert row["doctor_name"] == "Dr. Who"
    assert row["hospital_name"] == "General Hospital"


def test_platform_scans_forbidden_for_hospital_admin(client, db_service):
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id="h1", is_dev=False
    )
    res = client.get("/api/v1/platform/scans")
    assert res.status_code == 403
