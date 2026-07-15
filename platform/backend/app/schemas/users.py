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


class UserResponse(BaseModel):
    id: str
    hospital_id: str | None = None
    unique_identifier: str
    full_name: str
    email: str
    phone: str
    role: str
    account_status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    address: str | None = None


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
