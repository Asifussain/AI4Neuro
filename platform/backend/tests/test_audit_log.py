"""Tests for the Super Admin audit log read endpoint."""

from __future__ import annotations

from app.api.deps import get_current_user
from app.core.security import Principal


def _hospital_payload(code="H1"):
    return {
        "hospital_code": code,
        "name": "General Hospital",
        "address": "123 Main St",
    }


def test_audit_log_records_hospital_actions(client):
    create_res = client.post("/api/v1/platform/hospitals", json=_hospital_payload())
    assert create_res.status_code == 201
    hospital_id = create_res.json()["id"]

    client.post(f"/api/v1/platform/hospitals/{hospital_id}/deactivate")

    res = client.get("/api/v1/platform/audit-log")
    assert res.status_code == 200
    page = res.json()
    actions = [entry["action"] for entry in page["items"]]
    assert "hospital.create" in actions
    assert "hospital.inactive" in actions


def test_audit_log_forbidden_for_hospital_admin(client, db_service):
    hospital = db_service.create_hospital(_hospital_payload("H1"))
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id=hospital["id"], is_dev=False
    )
    res = client.get("/api/v1/platform/audit-log")
    assert res.status_code == 403


def test_audit_log_respects_pagination(client, db_service):
    hospital = db_service.create_hospital(_hospital_payload("H1"))
    for _ in range(3):
        db_service.insert_audit_log(
            actor_id=None, actor_role="super_admin", hospital_id=hospital["id"], action="hospital.update"
        )

    res = client.get("/api/v1/platform/audit-log?limit=2&offset=1")
    assert res.status_code == 200
    page = res.json()
    assert page["total"] == 3
    assert page["limit"] == 2
    assert page["offset"] == 1
    assert len(page["items"]) == 2
