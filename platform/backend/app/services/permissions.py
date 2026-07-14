"""Backend permission checks (doc 14.3).

Both legacy backends had NO backend authorization — they trusted client-supplied
ids and relied on the service-role key. This centralizes role/relationship checks
so they live in one place instead of scattered across route handlers.

Role hierarchy (multi-tenant):

    super_admin    — entire platform, no hospital boundary
    hospital_admin — everything within their own hospital (was "admin")
    doctor         — own hospital + assigned patients' sessions; may create either modality
    radiologist    — own hospital's MRI/EEG sessions they created / are assigned to
    patient        — their own completed sessions/reports

Fail closed: unknown roles get nothing. Missing/unknown hospital context is also
treated as a denial (not a permissive default) — hospital_id is a required tenancy
key for every role except super_admin.
"""

from __future__ import annotations

# Which roles may create an analysis of a given modality.
_CREATE_MATRIX: dict[str, set[str]] = {
    "eeg": {"super_admin", "hospital_admin", "radiologist", "doctor"},
    "mri": {"super_admin", "hospital_admin", "radiologist", "doctor"},
}


def can_create_analysis(role: str | None, modality: str) -> bool:
    return role in _CREATE_MATRIX.get(modality, set())


def _same_hospital(user_hospital, session_hospital) -> bool:
    """Whether two hospital ids refer to the same tenant.

    Fails closed: a missing value on either side denies access rather than
    granting it (hospital_id is a required tenancy key post-migration).
    """
    if not user_hospital or not session_hospital:
        return False
    return str(user_hospital) == str(session_hospital)


def can_read_session(
    user_id: str,
    role: str | None,
    hospital_id,
    session: dict,
) -> bool:
    """Whether ``user`` may read a given analysis_sessions row."""
    if role == "super_admin":
        return True

    if role == "hospital_admin":
        return _same_hospital(hospital_id, session.get("hospital_id"))

    if not _same_hospital(hospital_id, session.get("hospital_id")):
        return False

    uid = str(user_id)
    # Care-team members tied to the session.
    if uid in {
        str(session.get("uploaded_by")),
        str(session.get("doctor_id")),
        str(session.get("radiologist_id")),
    }:
        return True

    # Patient reading their own session (patient_id -> patient_profiles.user_id).
    if role == "patient" and uid == str(session.get("patient_id")):
        return True

    return False


def can_read_report(
    user_id: str, role: str | None, hospital_id, session: dict
) -> bool:
    """Report visibility currently matches session read access."""
    return can_read_session(user_id, role, hospital_id, session)


def can_retry_session(
    user_id: str, role: str | None, hospital_id, session: dict
) -> bool:
    """Only the uploader / care team / admins may retry (not the patient)."""
    if role == "patient":
        return False
    return can_read_session(user_id, role, hospital_id, session)


# --------------------------------------------------------------------------- #
# Hospital & user management (Super Admin / Hospital Admin)
# --------------------------------------------------------------------------- #

_HOSPITAL_MANAGED_ROLES = {"hospital_admin", "doctor", "radiologist", "patient"}


def can_manage_hospitals(role: str | None) -> bool:
    """Create/update/activate/deactivate/delete hospitals — super_admin only."""
    return role == "super_admin"


def can_view_hospital(role: str | None, actor_hospital_id, target_hospital_id) -> bool:
    if role == "super_admin":
        return True
    if role == "hospital_admin":
        return _same_hospital(actor_hospital_id, target_hospital_id)
    return False


def can_create_user_with_role(
    actor_role: str | None,
    target_role: str,
    *,
    actor_hospital_id=None,
    target_hospital_id=None,
) -> bool:
    """Whether ``actor_role`` may create a user with ``target_role``.

    super_admin may create any role in any hospital (including further
    super_admins). hospital_admin may only create hospital-scoped roles, and
    only within their own hospital.
    """
    if actor_role == "super_admin":
        return True
    if actor_role == "hospital_admin":
        if target_role not in ("doctor", "radiologist", "patient"):
            return False
        return _same_hospital(actor_hospital_id, target_hospital_id)
    return False


def can_manage_user(
    actor_role: str | None,
    actor_hospital_id,
    target_hospital_id,
    target_role: str | None = None,
) -> bool:
    """Whether the actor may view/update/suspend a given user."""
    if actor_role == "super_admin":
        return True
    if actor_role == "hospital_admin":
        if target_role == "super_admin":
            return False
        return _same_hospital(actor_hospital_id, target_hospital_id)
    return False


def can_assign_doctor_to_patient(
    actor_role: str | None, actor_hospital_id, hospital_id
) -> bool:
    if actor_role == "super_admin":
        return True
    if actor_role == "hospital_admin":
        return _same_hospital(actor_hospital_id, hospital_id)
    return False


def can_view_platform_analytics(role: str | None) -> bool:
    return role == "super_admin"


def can_view_hospital_analytics(role: str | None, actor_hospital_id, target_hospital_id) -> bool:
    if role == "super_admin":
        return True
    if role == "hospital_admin":
        return _same_hospital(actor_hospital_id, target_hospital_id)
    return False


def can_manage_platform_settings(role: str | None) -> bool:
    return role == "super_admin"
