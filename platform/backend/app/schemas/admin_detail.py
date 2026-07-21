"""Response schemas for the Super Admin drill-down profile pages.

Each of these is a single "give me everything about this one person/hospital"
read model, assembled server-side from user_profiles + the role-detail table +
analysis_sessions — there was previously no such single-entity detail
endpoint anywhere (only paginated directory lists). See
app/api/v1/platform_admin.py for the routes that build these.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.analysis import SessionStatusResponse


class PatientBrief(BaseModel):
    id: str
    full_name: str
    email: str
    patient_code: str | None = None
    account_status: str


class DoctorProfileDetail(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    avatar_url: str | None = None
    account_status: str
    created_at: datetime | None = None

    hospital_id: str | None = None
    hospital_name: str | None = None
    hospital_admin_name: str | None = None

    medical_license: str | None = None
    specialization: str | None = None
    qualification_name: str | None = None
    experience_years: int | None = None
    verification_status: str | None = None

    patient_count: int
    patients: list[PatientBrief]

    mri_count: int
    eeg_count: int
    pending_reports: int
    completed_reports: int
    recent_sessions: list[SessionStatusResponse]


class RadiologistProfileDetail(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    avatar_url: str | None = None
    account_status: str
    created_at: datetime | None = None

    hospital_id: str | None = None
    hospital_name: str | None = None

    radiologist_license: str | None = None
    imaging_expertise: str | None = None
    certifications: str | None = None
    qualification_name: str | None = None
    experience_years: int | None = None
    verification_status: str | None = None

    mri_count: int
    eeg_count: int
    pending_reports: int
    completed_reports: int
    recent_sessions: list[SessionStatusResponse]


class PatientProfileDetail(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    avatar_url: str | None = None
    account_status: str
    created_at: datetime | None = None

    hospital_id: str | None = None
    hospital_name: str | None = None

    patient_code: str | None = None
    date_of_birth: str | None = None
    blood_type: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    verification_status: str | None = None

    assigned_doctor_id: str | None = None
    assigned_doctor_name: str | None = None
    # There's no formal "assigned radiologist" relationship (unlike
    # doctor_patient_relationships) — best-effort, taken from the radiologist
    # on the patient's most recent session.
    assigned_radiologist_id: str | None = None
    assigned_radiologist_name: str | None = None

    mri_sessions: list[SessionStatusResponse]
    eeg_sessions: list[SessionStatusResponse]
    reports_count: int


class HospitalAdminProfileDetail(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    avatar_url: str | None = None
    account_status: str
    created_at: datetime | None = None

    hospital_id: str | None = None
    hospital_name: str | None = None
    hospital_code: str | None = None
    hospital_address: str | None = None
    hospital_status: str | None = None

    doctor_count: int
    radiologist_count: int
    patient_count: int

    mri_count: int
    eeg_count: int
    reports_generated: int
    pending_reports: int

    recent_sessions: list[SessionStatusResponse]
