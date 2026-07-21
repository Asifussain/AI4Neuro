"""Report context (comprehensive_data) builder.

The ported EEG and MRI PDF builders consume a nested ``comprehensive_data`` dict
(hospital / patient / doctor / session / …). The two legacy backends fetched this
from Supabase (``get_comprehensive_report_data``) with a mock fallback.

``build_report_context`` stays a pure function — no DB import here, so it's
trivially testable — and accepts optional pre-fetched rows. The caller
(``PdfReportService.generate_reports``) does the actual lookups and passes
whatever it managed to fetch; anything missing falls back to today's mock
block, as a *whole* block rather than mixing real and mock fields within one
person/hospital — a real patient name next to a mock date of birth on a
document that otherwise looks authoritative would be more misleading than an
obviously-placeholder block.
"""

from __future__ import annotations

import datetime
from typing import Any


def build_report_context(
    session: dict,
    modality: str,
    *,
    hospital: dict | None = None,
    patient: dict | None = None,
    patient_profile: dict | None = None,
    doctor: dict | None = None,
    doctor_profile: dict | None = None,
    radiologist: dict | None = None,
    radiologist_profile: dict | None = None,
) -> dict[str, Any]:
    """Assemble the comprehensive_data dict the PDF builders expect."""
    now = datetime.datetime.now(datetime.timezone.utc)
    analysis_type = session.get("analysis_type", "")
    session_code = session.get("session_code") or (
        f"{modality.upper()}-{str(session.get('id', ''))[:8]}"
    )
    scan_or_session_label = (
        "MRI AI Analysis" if modality == "mri" else "EEG AI Analysis"
    )

    return {
        "hospital": hospital or {
            "name": "General Neural Hospital",
            "address": "123 Medical Center Dr",
            "city": "Neuropolis",
            "state": "NY",
            "pincode": "10001",
            "phone": "+1 (555) 012-3456",
            "email": "neuro@hospital.com",
            "license_number": "HOSP-000000",
            "hospital_code": "GNH",
        },
        "patient": patient or {
            "full_name": "Patient (Pending Identification)",
            "phone": "N/A",
            "email": "N/A",
            "date_of_birth": None,
            "address": "N/A",
            "unique_identifier": str(session.get("patient_id", "N/A")),
        },
        "patient_profile": patient_profile or {
            "patient_code": session_code.replace(modality.upper(), "PAT"),
            "date_of_birth": None,
            "gender": "N/A",
            "medical_history": "Not available in this report context.",
        },
        "doctor": doctor or {"full_name": "Assigned Clinician", "phone": "N/A", "email": "N/A"},
        "doctor_profile": doctor_profile or {
            "specialization": "Neurology",
            "license_number": "MED-000000",
        },
        "radiologist": radiologist or {"full_name": "Assigned Radiologist", "phone": "N/A"},
        "radiologist_profile": radiologist_profile or {"imaging_expertise": "Neuroimaging"},
        "blood_group": None,
        "doctor_qualification": None,
        "radiologist_qualification": None,
        "session": {
            "session_code": session_code,
            "scan_date": (session.get("created_at") or now.isoformat()),
            "session_date": (session.get("created_at") or now.isoformat()),
            "analysis_type": analysis_type or scan_or_session_label,
            "scanner_manufacturer": "N/A",
            "scanner_model": "N/A",
            "sequence_type": "N/A",
        },
    }
