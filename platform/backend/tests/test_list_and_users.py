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
