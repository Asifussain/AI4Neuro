"""Request/response schemas for hospital and user management.

Covers the Super Admin (platform-wide) and Hospital Admin (single-tenant)
management surface: hospitals, and the doctor/radiologist/patient/hospital_admin
accounts within them.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Role(str, Enum):
    """The 5 platform roles.

    NOTE on ``hospital_admin``: its wire/DB value is the string ``"admin"``
    (kept for backward compatibility with existing rows/JWTs — this is a
    naming quirk, not a semantic difference). It means a hospital-scoped
    admin, i.e. an admin whose authority is limited to their own
    ``hospital_id``. Do not confuse it with ``super_admin``, which is
    platform-wide and hospital-less. Every other comment in this codebase
    that re-explains this distinction should point back to this enum instead
    of repeating it.
    """

    super_admin = "super_admin"
    hospital_admin = "admin"
    doctor = "doctor"
    radiologist = "radiologist"
    patient = "patient"


class HospitalStatus(str, Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"


# --------------------------------------------------------------------------- #
# Hospitals
# --------------------------------------------------------------------------- #


class HospitalCreate(BaseModel):
    hospital_code: str
    name: str
    address: str
    phone: str | None = None
    email: str | None = None
    license_number: str | None = None
    established_date: str | None = None


class HospitalUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    license_number: str | None = None
    established_date: str | None = None


class HospitalResponse(BaseModel):
    id: str
    hospital_code: str
    name: str
    address: str
    phone: str | None = None
    email: str | None = None
    license_number: str | None = None
    established_date: str | None = None
    status: str
    created_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# --------------------------------------------------------------------------- #
# Users
# --------------------------------------------------------------------------- #


class UserCreate(BaseModel):
    full_name: str
    email: str
    phone: str
    role: Role
    unique_identifier: str
    # Required for super_admin creating into a specific hospital; ignored (and
    # forced to the caller's own hospital) for hospital_admin callers.
    hospital_id: str | None = None
    date_of_birth: str | None = None
    address: str | None = None
    qualification: str | None = None


class UserResponse(BaseModel):
    id: str
    hospital_id: str | None = None
    unique_identifier: str
    full_name: str
    email: str
    phone: str
    avatar_url: str | None = None
    role: str
    account_status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    # Optional role-detail / auth-claim bag. Populated by /users/me (the
    # caller's own Principal.profile) so that endpoint is shape-compatible
    # with /hospital/users/{id}; omitted (None) elsewhere.
    profile: dict | None = None


class UserCreateResult(UserResponse):
    """Response for endpoints that provision a new login-capable account.

    ``temporary_password`` is returned exactly once, on creation, and must
    never be logged or persisted anywhere else — see
    app/services/auth_admin.py.
    """

    temporary_password: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    address: str | None = None
    avatar_url: str | None = None
    qualification: str | None = None
    license_number: str | None = None
    specialization: str | None = None
    experience_years: int | None = None
    date_of_birth: str | None = None
    emergency_contact: str | None = None
    # Patient-only, editable (unlike assigned_doctor_id/hospital_id, which are
    # care-team-managed and never patient-writable). FK -> blood_groups.id.
    blood_group_id: int | None = None


class BloodGroupResponse(BaseModel):
    id: int
    blood_type: str


class AssignDoctorRequest(BaseModel):
    doctor_id: str
    patient_id: str
    notes: str | None = None


class DoctorDirectoryEntry(BaseModel):
    """A doctor account merged with its doctor_profiles detail row."""

    id: str
    hospital_id: str | None = None
    full_name: str
    email: str
    phone: str
    account_status: str
    specialization: str | None = None
    medical_license: str | None = None
    experience_years: int | None = None
    verification_status: str | None = None
    created_at: datetime | None = None


class PatientDirectoryEntry(BaseModel):
    """A patient account merged with its patient_profiles detail row."""

    id: str
    hospital_id: str | None = None
    full_name: str
    email: str
    phone: str
    account_status: str
    patient_code: str | None = None
    verification_status: str | None = None
    created_at: datetime | None = None


class AssignmentResponse(BaseModel):
    id: str
    doctor_id: str
    doctor_name: str
    patient_id: str
    patient_name: str
    hospital_id: str | None = None
    notes: str | None = None
    created_at: datetime | None = None


class VerificationResponse(BaseModel):
    user_id: str
    role: str
    verification_status: str


class PlatformSettingsUpdate(BaseModel):
    settings: dict = Field(default_factory=dict)


class PlatformSettingsResponse(BaseModel):
    settings: dict
    updated_at: datetime | None = None
    updated_by: str | None = None
