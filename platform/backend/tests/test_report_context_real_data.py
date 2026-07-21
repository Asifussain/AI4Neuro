"""Real-data lookups for the PDF report context (Phase 2 F23).

build_report_context itself stays pure/mock-only in its own tests
(test_reports.py); this exercises PdfReportService._fetch_context_kwargs,
the piece that turns a session's ids into real hospital/patient/doctor/
radiologist data, with a graceful (never-raising) fallback per id.
"""

from __future__ import annotations

from app.services.reports import PdfReportService
from app.services.storage import StorageService


def _hospital(db_service):
    return db_service.create_hospital(
        {"hospital_code": "H1", "name": "Real Hospital", "address": "1 Real St"}
    )


def _person(db_service, hospital_id, *, role, table, profile_row, **user_overrides):
    user = db_service.create_user_profile(
        {
            "hospital_id": hospital_id,
            "unique_identifier": f"{role.upper()}-1",
            "full_name": f"Real {role.title()}",
            "email": f"{role}@example.com",
            "phone": "555-0100",
            "role": role,
            "account_status": "active",
            **user_overrides,
        }
    )
    db_service.create_role_profile(table, {"user_id": user["id"], **profile_row})
    return user


def test_fetch_context_kwargs_returns_real_data_for_every_participant(db_service, fake_supabase):
    storage = StorageService(client=fake_supabase)
    svc = PdfReportService(storage, db=db_service)

    hospital = _hospital(db_service)
    patient = _person(
        db_service, hospital["id"], role="patient", table="patient_profiles",
        profile_row={"patient_id": "PAT-001", "medical_history": "None on file."},
        date_of_birth="1990-01-01",
    )
    doctor = _person(
        db_service, hospital["id"], role="doctor", table="doctor_profiles",
        profile_row={"medical_license": "LIC-1", "specialization": "Neurology", "experience_years": 5},
    )
    radiologist = _person(
        db_service, hospital["id"], role="radiologist", table="radiologist_profiles",
        profile_row={
            "radiologist_license": "RAD-1", "imaging_expertise": "MRI", "experience_years": 3,
        },
    )

    session = {
        "hospital_id": hospital["id"],
        "patient_id": patient["id"],
        "doctor_id": doctor["id"],
        "radiologist_id": radiologist["id"],
    }

    kwargs = svc._fetch_context_kwargs(session)

    assert kwargs["hospital"]["name"] == "Real Hospital"
    assert kwargs["patient"]["full_name"] == "Real Patient"
    assert kwargs["patient_profile"]["patient_code"] == "PAT-001"
    assert kwargs["doctor"]["full_name"] == "Real Doctor"
    assert kwargs["doctor_profile"]["license_number"] == "LIC-1"
    assert kwargs["radiologist"]["full_name"] == "Real Radiologist"
    assert kwargs["radiologist_profile"]["imaging_expertise"] == "MRI"


def test_fetch_context_kwargs_is_empty_when_db_not_given(fake_supabase):
    storage = StorageService(client=fake_supabase)
    svc = PdfReportService(storage)  # no db= at all, matching every pre-existing caller
    assert svc._fetch_context_kwargs({"hospital_id": "h1", "patient_id": "p1"}) == {}


def test_fetch_context_kwargs_skips_gracefully_on_missing_or_unknown_ids(db_service, fake_supabase):
    storage = StorageService(client=fake_supabase)
    svc = PdfReportService(storage, db=db_service)

    kwargs = svc._fetch_context_kwargs(
        {"hospital_id": "does-not-exist", "patient_id": "also-missing", "doctor_id": None}
    )
    # No lookup raised; each missing/unknown id simply contributes nothing,
    # leaving build_report_context's mock fallback for those blocks.
    assert kwargs == {}
