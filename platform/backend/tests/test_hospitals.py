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
    res = client.post("/api/v1/hospitals", json=_hospital_payload())
    assert res.status_code == 201
    hospital = res.json()
    assert hospital["status"] == "active"

    res = client.get("/api/v1/hospitals")
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_hospital_admin_cannot_create_hospital(client):
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id="h1", is_dev=False
    )
    res = client.post("/api/v1/hospitals", json=_hospital_payload())
    assert res.status_code == 403


def test_hospital_admin_sees_only_own_hospital(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    db_service.create_hospital(_hospital_payload("H2"))

    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id=h1["id"], is_dev=False
    )
    res = client.get("/api/v1/hospitals")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["id"] == h1["id"]


def test_deactivate_hospital(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    res = client.post(f"/api/v1/hospitals/{h1['id']}/deactivate")
    assert res.status_code == 200
    assert res.json()["status"] == "inactive"


def test_hospital_admin_creates_doctor_in_own_hospital(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id=h1["id"], is_dev=False
    )
    res = client.post(
        "/api/v1/users",
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


def test_hospital_admin_cannot_create_super_admin(client, db_service):
    h1 = db_service.create_hospital(_hospital_payload("H1"))
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id=h1["id"], is_dev=False
    )
    res = client.post(
        "/api/v1/users",
        json={
            "full_name": "Rogue",
            "email": "rogue@example.com",
            "phone": "555-0101",
            "role": "super_admin",
            "unique_identifier": "SA-1",
        },
    )
    assert res.status_code == 403


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
    res = client.get("/api/v1/users")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["hospital_id"] == h1["id"]


def test_platform_analytics_super_admin_only(client, db_service):
    res = client.get("/api/v1/analytics/platform")
    assert res.status_code == 200

    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id="h1", is_dev=False
    )
    res = client.get("/api/v1/analytics/platform")
    assert res.status_code == 403
