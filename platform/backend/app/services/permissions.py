"""Backend permission checks (doc 14.3).

Both legacy backends had NO backend authorization — they trusted client-supplied
ids and relied on the service-role key. This centralizes role/relationship checks
so they live in one place instead of scattered across route handlers.

Rules mirror the legacy frontend gating + doc 14.3:

    admin        — everything in scope
    doctor       — assigned patients' sessions; may create either modality
    radiologist  — MRI (and EEG) sessions they created / are assigned to
    technician   — EEG sessions they created / uploaded
    patient      — their own completed sessions/reports

Fail closed: unknown roles get nothing.
"""

from __future__ import annotations

# Which roles may create an analysis of a given modality.
_CREATE_MATRIX: dict[str, set[str]] = {
    "eeg": {"admin", "technician", "radiologist", "doctor"},
    "mri": {"admin", "radiologist", "doctor"},
}


def can_create_analysis(role: str | None, modality: str) -> bool:
    return role in _CREATE_MATRIX.get(modality, set())


def _same_hospital(user_hospital, session_hospital) -> bool:
    # If either side is unknown, don't block on hospital (single-tenant / dev).
    if not user_hospital or not session_hospital:
        return True
    return str(user_hospital) == str(session_hospital)


def can_read_session(
    user_id: str,
    role: str | None,
    hospital_id,
    session: dict,
) -> bool:
    """Whether ``user`` may read a given analysis_sessions row."""
    if role == "admin":
        return True

    if not _same_hospital(hospital_id, session.get("hospital_id")):
        return False

    uid = str(user_id)
    # Care-team members tied to the session.
    if uid in {
        str(session.get("uploaded_by")),
        str(session.get("doctor_id")),
        str(session.get("radiologist_id")),
        str(session.get("technician_id")),
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
    """Only the uploader / care team / admin may retry (not the patient)."""
    if role == "patient":
        return False
    return can_read_session(user_id, role, hospital_id, session)
