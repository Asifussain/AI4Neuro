"""Shared helpers used by both platform_admin.py and hospital_admin.py.

Split out of the old monolithic admin.py so the two route modules (super_admin
-only platform actions vs. hospital-scoped admin actions) don't duplicate the
same lookups, scoping helpers, and role/profile-table mapping.
"""

from __future__ import annotations

from fastapi import HTTPException, status

from app.core.security import Principal
from app.schemas.users import Role
from app.services.database import DatabaseService

# Role-detail table for each role that has one. See app/schemas/users.py's
# Role enum docstring for the "admin" wire-value == hospital_admin note.
ROLE_PROFILE_TABLE = {
    Role.hospital_admin.value: "hospital_admin_profiles",
    Role.doctor.value: "doctor_profiles",
    Role.radiologist.value: "radiologist_profiles",
    Role.patient.value: "patient_profiles",
    Role.super_admin.value: "super_admin_profiles",
}

# Only these role-detail tables carry a verification_status column.
VERIFIABLE_ROLES = {Role.doctor.value, Role.radiologist.value, Role.patient.value}

# Roles allowed to browse the clinical directories (doctors / patients) so they
# can attach a patient/doctor when starting an analysis. Wider than the admin
# user directory, but still hospital-scoped for every non-super_admin caller.
CLINICAL_DIRECTORY_ROLES = {"super_admin", "admin", "doctor", "radiologist"}


def scope_hospital(principal: Principal, hospital_id: str | None) -> str | None:
    """Resolve the effective hospital filter for the admin user directory.

    super_admin may pass an optional cross-hospital filter; hospital_admin is
    pinned to their own hospital. Other roles are denied.
    """
    if principal.role == "super_admin":
        return hospital_id
    if principal.role == "admin":
        return principal.hospital_id
    raise forbid("You do not have access to this directory.")


def scope_hospital_clinical(principal: Principal, hospital_id: str | None) -> str | None:
    """Hospital filter for the doctor/patient pickers used by the analysis flow."""
    if principal.role not in CLINICAL_DIRECTORY_ROLES:
        raise forbid("You do not have access to this directory.")
    if principal.role == "super_admin":
        return hospital_id
    return principal.hospital_id


def require_user(db: DatabaseService, user_id: str) -> dict:
    user = db.get_user_profile(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "user_not_found", "message": "User not found."},
        )
    return user


def require_hospital(db: DatabaseService, hospital_id: str) -> dict:
    hospital = db.get_hospital(hospital_id)
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "hospital_not_found", "message": "Hospital not found."},
        )
    return hospital


def forbid(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "permission_denied", "message": message},
    )


def paginate(items: list, *, limit: int, offset: int) -> tuple[list, int]:
    """Slice an already-filtered list and return (page, total).

    ``total`` is the pre-slice count (see PaginatedResponse docstring for why
    this is acceptable given the underlying fetch-then-filter DB pattern).
    """
    total = len(items)
    return items[offset : offset + limit], total
