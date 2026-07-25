"""Strict multi-tenant scan visibility & access-control tests.

Proves the four required rules end-to-end through the real API + FakeSupabase:

1. Super Admin platform-level scans (NULL hospital_id) are private — they never
   appear in any hospital admin / doctor / radiologist list or single read.
2. Hospital scans are visible only within that hospital (admin sees all its
   scans; the assigned doctor / radiologist see their own; patient sees theirs).
3. Super Admin has global visibility — every scan across every hospital plus the
   platform-level ones.
4. No hospital can read another hospital's scans (list or single).
"""

from __future__ import annotations

from app.api.deps import get_current_user
from app.core.security import Principal


def _as(client, *, user_id, role, hospital_id):
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id=user_id, role=role, hospital_id=hospital_id, is_dev=False
    )


def _mk(db_service, **kw):
    return db_service.create_session(
        modality=kw.get("modality", "eeg"),
        analysis_type="binary",
        original_filename="x.npy",
        patient_id=kw.get("patient_id"),
        doctor_id=kw.get("doctor_id"),
        radiologist_id=kw.get("radiologist_id"),
        hospital_id=kw.get("hospital_id"),
        uploaded_by=kw.get("uploaded_by"),
        uploaded_by_role=kw.get("uploaded_by_role"),
    )


def _list_ids(client):
    res = client.get("/api/v1/analysis?limit=200")
    assert res.status_code == 200, res.text
    return {item["id"] for item in res.json()["items"]}


def _fixture_scans(db_service):
    """A platform-level super-admin scan + two hospitals' scans."""
    platform = _mk(
        db_service, hospital_id=None, patient_id=None,
        uploaded_by="sa1", uploaded_by_role="super_admin",
    )
    h1 = _mk(
        db_service, hospital_id="h1", patient_id="p1",
        doctor_id="d1", radiologist_id="r1", uploaded_by="r1",
        uploaded_by_role="radiologist",
    )
    h2 = _mk(
        db_service, hospital_id="h2", patient_id="p2",
        doctor_id="d2", radiologist_id="r2", uploaded_by="d2",
        uploaded_by_role="doctor",
    )
    return platform, h1, h2


# ---- Rule 1 + 4: platform scan private; cross-hospital denied -------------- #
def test_hospital_admin_sees_only_own_hospital(client, db_service):
    platform, h1, h2 = _fixture_scans(db_service)
    _as(client, user_id="ha1", role="admin", hospital_id="h1")
    ids = _list_ids(client)
    assert h1["id"] in ids
    assert platform["id"] not in ids, "super-admin platform scan leaked to hospital admin"
    assert h2["id"] not in ids, "other hospital's scan leaked to hospital admin"


def test_doctor_sees_only_assigned_in_own_hospital(client, db_service):
    platform, h1, h2 = _fixture_scans(db_service)
    _as(client, user_id="d1", role="doctor", hospital_id="h1")
    ids = _list_ids(client)
    assert h1["id"] in ids          # assigned doctor on the h1 scan
    assert platform["id"] not in ids
    assert h2["id"] not in ids


def test_radiologist_sees_only_assigned_in_own_hospital(client, db_service):
    platform, h1, h2 = _fixture_scans(db_service)
    _as(client, user_id="r1", role="radiologist", hospital_id="h1")
    ids = _list_ids(client)
    assert h1["id"] in ids          # assigned radiologist on the h1 scan
    assert platform["id"] not in ids
    assert h2["id"] not in ids


def test_doctor_of_other_hospital_cannot_see_or_read(client, db_service):
    platform, h1, h2 = _fixture_scans(db_service)
    _as(client, user_id="d2", role="doctor", hospital_id="h2")
    ids = _list_ids(client)
    assert h2["id"] in ids
    assert h1["id"] not in ids
    # Single read of the other hospital's scan is forbidden.
    res = client.get(f"/api/v1/analysis/{h1['id']}")
    assert res.status_code == 403


# ---- Rule 1: platform scan not readable by any tenant --------------------- #
def test_platform_scan_single_read_denied_for_tenants(client, db_service):
    platform, h1, h2 = _fixture_scans(db_service)
    for uid, role, hosp in [
        ("ha1", "admin", "h1"),
        ("d1", "doctor", "h1"),
        ("r1", "radiologist", "h1"),
        ("p1", "patient", "h1"),
    ]:
        _as(client, user_id=uid, role=role, hospital_id=hosp)
        res = client.get(f"/api/v1/analysis/{platform['id']}")
        assert res.status_code == 403, f"{role} could read the platform scan"
        res_r = client.get(f"/api/v1/analysis/{platform['id']}/reports")
        assert res_r.status_code == 403, f"{role} could read the platform report"


# ---- Rule 3: super admin global visibility -------------------------------- #
def test_super_admin_sees_every_scan(client, db_service):
    platform, h1, h2 = _fixture_scans(db_service)
    _as(client, user_id="sa1", role="super_admin", hospital_id=None)
    ids = _list_ids(client)
    assert {platform["id"], h1["id"], h2["id"]} <= ids


def test_super_admin_can_narrow_to_one_hospital(client, db_service):
    platform, h1, h2 = _fixture_scans(db_service)
    _as(client, user_id="sa1", role="super_admin", hospital_id=None)
    res = client.get("/api/v1/analysis?hospital_id=h1&limit=200")
    ids = {item["id"] for item in res.json()["items"]}
    assert h1["id"] in ids
    assert h2["id"] not in ids
    assert platform["id"] not in ids  # scoping to a hospital excludes platform scans


def test_super_admin_can_read_platform_and_hospital_scans(client, db_service):
    platform, h1, h2 = _fixture_scans(db_service)
    _as(client, user_id="sa1", role="super_admin", hospital_id=None)
    for sid in (platform["id"], h1["id"], h2["id"]):
        assert client.get(f"/api/v1/analysis/{sid}").status_code == 200


def test_unassigned_doctor_same_hospital_does_not_see_scan(client, db_service):
    """Rule 2 is 'assigned' doctor/radiologist — a same-hospital doctor NOT on
    the session must not see it in their list (the hospital admin still can)."""
    _platform, h1, _h2 = _fixture_scans(db_service)
    _as(client, user_id="d-other", role="doctor", hospital_id="h1")
    assert h1["id"] not in _list_ids(client)
    # Single read is likewise forbidden for the unassigned doctor.
    assert client.get(f"/api/v1/analysis/{h1['id']}").status_code == 403


# ---- Rule 2: patient sees only their own hospital scan -------------------- #
def test_patient_sees_only_their_own_scan(client, db_service):
    platform, h1, h2 = _fixture_scans(db_service)
    _as(client, user_id="p1", role="patient", hospital_id="h1")
    ids = _list_ids(client)
    assert h1["id"] in ids
    assert h2["id"] not in ids
    assert platform["id"] not in ids
