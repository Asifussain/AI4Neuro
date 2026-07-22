"""Report context (comprehensive_data) builder.

The ported EEG and MRI PDF builders consume a nested ``comprehensive_data`` dict
(hospital / patient / doctor / session / …). The two legacy backends fetched this
from Supabase (``get_comprehensive_report_data``) with a mock fallback.

When a ``DatabaseService`` is supplied the builder now hydrates the context with
the **real** patient / hospital / doctor / radiologist records tied to the
analysis session (``build_report_context(session, modality, db=db)``). Every
lookup is defensive: a missing row, a missing field, or no ``db`` at all falls
back to a safe placeholder so report generation never fails on incomplete data.
"""

from __future__ import annotations

import datetime
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

_NA = "N/A"


def build_report_context(session: dict, modality: str, db: Any | None = None) -> dict[str, Any]:
    """Assemble the comprehensive_data dict the PDF builders expect.

    Args:
        session: the ``analysis_sessions`` row being reported on.
        modality: ``"mri"`` or ``"eeg"``.
        db: an optional ``DatabaseService``. When provided, real hospital /
            patient / doctor / radiologist records are fetched and used; when
            absent (or a lookup fails) placeholder values are used instead so
            the report still renders.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    analysis_type = session.get("analysis_type", "")
    session_code = session.get("session_code") or (
        f"{modality.upper()}-{str(session.get('id', ''))[:8]}"
    )
    scan_or_session_label = (
        "MRI AI Analysis" if modality == "mri" else "EEG AI Analysis"
    )

    # --- Real records (best-effort; each returns a dict, possibly empty) ---- #
    records = _fetch_records(session, db)
    hospital = records["hospital"]
    patient_user = records["patient_user"]
    patient_profile = records["patient_profile"]
    doctor_user = records["doctor_user"]
    doctor_profile = records["doctor_profile"]
    radiologist_user = records["radiologist_user"]
    radiologist_profile = records["radiologist_profile"]
    blood_group = records["blood_group"]
    doctor_qualification = records["doctor_qualification"]
    radiologist_qualification = records["radiologist_qualification"]

    return {
        "hospital": {
            "name": hospital.get("name") or "General Neural Hospital",
            "address": hospital.get("address") or _NA,
            "city": hospital.get("city") or "",
            "state": hospital.get("state") or "",
            "pincode": hospital.get("pincode") or "",
            "phone": hospital.get("phone") or _NA,
            "email": hospital.get("email") or _NA,
            "license_number": hospital.get("license_number") or _NA,
            "hospital_code": hospital.get("hospital_code") or _NA,
        },
        "patient": {
            "full_name": patient_user.get("full_name") or "Patient (Pending Identification)",
            "phone": patient_user.get("phone") or _NA,
            "email": patient_user.get("email") or _NA,
            "date_of_birth": patient_user.get("date_of_birth"),
            "gender": patient_profile.get("gender") or patient_user.get("gender"),
            "address": patient_user.get("address") or _NA,
            "unique_identifier": (
                patient_user.get("unique_identifier")
                or str(session.get("patient_id", _NA))
            ),
        },
        "patient_profile": {
            "patient_code": (
                patient_profile.get("patient_id")
                or patient_user.get("unique_identifier")
                or session_code.replace(modality.upper(), "PAT")
            ),
            "date_of_birth": patient_user.get("date_of_birth"),
            "gender": patient_profile.get("gender") or patient_user.get("gender") or _NA,
            "medical_history": patient_profile.get("medical_history") or "",
            "current_medications": patient_profile.get("current_medications") or "",
            "allergies": patient_profile.get("allergies") or "",
            "emergency_contact_name": patient_profile.get("emergency_contact_name"),
            "emergency_contact_phone": patient_profile.get("emergency_contact_phone"),
        },
        "doctor": {
            "full_name": doctor_user.get("full_name") or "Assigned Clinician",
            "phone": doctor_user.get("phone") or _NA,
            "email": doctor_user.get("email") or _NA,
        },
        "doctor_profile": {
            "specialization": (
                doctor_profile.get("specialization")
                or doctor_qualification.get("specialization")
                or "Neurology"
            ),
            "license_number": doctor_profile.get("medical_license") or _NA,
            "experience_years": doctor_profile.get("experience_years"),
        },
        "radiologist": {
            "full_name": radiologist_user.get("full_name") or "Assigned Radiologist",
            "phone": radiologist_user.get("phone") or _NA,
            "email": radiologist_user.get("email") or _NA,
        },
        "radiologist_profile": {
            # imaging_expertise is optional in the schema; fall back only when empty.
            "imaging_expertise": radiologist_profile.get("imaging_expertise") or "Neuroimaging",
            "license_number": radiologist_profile.get("radiologist_license") or _NA,
            "specialization": radiologist_qualification.get("specialization"),
            "experience_years": radiologist_profile.get("experience_years"),
        },
        "blood_group": blood_group,
        "doctor_qualification": doctor_qualification or None,
        "radiologist_qualification": radiologist_qualification or None,
        "session": {
            "session_code": session_code,
            "scan_date": (session.get("created_at") or now.isoformat()),
            "session_date": (session.get("created_at") or now.isoformat()),
            "analysis_type": analysis_type or scan_or_session_label,
            "original_filename": session.get("original_filename"),
            "scanner_manufacturer": _NA,
            "scanner_model": _NA,
            "sequence_type": _NA,
        },
    }


def _fetch_records(session: dict, db: Any | None) -> dict[str, Any]:
    """Best-effort fetch of every DB record a report references.

    Returns a dict of records (each an empty dict when unavailable) so the
    caller can build the context with plain ``.get()`` chains regardless of
    whether ``db`` was supplied or a given lookup succeeded.
    """
    empty = {
        "hospital": {},
        "patient_user": {},
        "patient_profile": {},
        "doctor_user": {},
        "doctor_profile": {},
        "radiologist_user": {},
        "radiologist_profile": {},
        "blood_group": None,
        "doctor_qualification": {},
        "radiologist_qualification": {},
    }
    if db is None:
        return empty

    records = dict(empty)
    try:
        hospital_id = session.get("hospital_id")
        if hospital_id:
            records["hospital"] = _safe(lambda: db.get_hospital(hospital_id)) or {}

        patient_id = session.get("patient_id")
        if patient_id:
            records["patient_user"] = _safe(lambda: db.get_user_profile(patient_id)) or {}
            records["patient_profile"] = (
                _safe(lambda: db.get_role_profile("patient_profiles", patient_id)) or {}
            )

        doctor_id = session.get("doctor_id")
        if doctor_id:
            records["doctor_user"] = _safe(lambda: db.get_user_profile(doctor_id)) or {}
            records["doctor_profile"] = (
                _safe(lambda: db.get_role_profile("doctor_profiles", doctor_id)) or {}
            )

        radiologist_id = session.get("radiologist_id")
        if radiologist_id:
            records["radiologist_user"] = (
                _safe(lambda: db.get_user_profile(radiologist_id)) or {}
            )
            records["radiologist_profile"] = (
                _safe(lambda: db.get_role_profile("radiologist_profiles", radiologist_id))
                or {}
            )

        # Reference lookups (blood group + qualifications) are id → name maps.
        _hydrate_reference_data(db, records)
    except Exception as exc:  # noqa: BLE001 - context building must never fail the job
        logger.warning("Report context DB hydration failed: %s", exc)

    return records


def _hydrate_reference_data(db: Any, records: dict[str, Any]) -> None:
    """Resolve blood_group_id / qualification_id foreign keys to display values."""
    blood_group_id = (records["patient_profile"] or {}).get("blood_group_id")
    if blood_group_id is not None:
        groups = _safe(lambda: db.list_blood_groups()) or []
        match = next((g for g in groups if g.get("id") == blood_group_id), None)
        if match:
            records["blood_group"] = match.get("blood_type")

    doc_qual_id = (records["doctor_profile"] or {}).get("qualification_id")
    rad_qual_id = (records["radiologist_profile"] or {}).get("qualification_id")
    if doc_qual_id is not None or rad_qual_id is not None:
        quals = _safe(lambda: db.list_qualifications()) or []
        by_id = {q.get("id"): q for q in quals}
        if doc_qual_id is not None and doc_qual_id in by_id:
            records["doctor_qualification"] = by_id[doc_qual_id]
        if rad_qual_id is not None and rad_qual_id in by_id:
            records["radiologist_qualification"] = by_id[rad_qual_id]


def _safe(fn):
    """Run a DB lookup, swallowing errors (return None) so one bad table read
    never aborts the whole context build."""
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001
        logger.debug("Report context lookup failed: %s", exc)
        return None
