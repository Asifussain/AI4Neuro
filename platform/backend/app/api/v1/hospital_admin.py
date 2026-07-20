"""Hospital-scoped management API — reachable by both ``admin`` (hospital_admin)
and ``super_admin``.

For an ``admin`` caller, every route is pinned to their own ``hospital_id``
(via ``_common.scope_hospital`` / ``scope_hospital_clinical``); a
``super_admin`` caller may pass an explicit ``hospital_id`` query param to
cross-scope. Doctor/radiologist callers also reach the clinical-directory
subset (``/doctors``, ``/patients``, ``/patients/mine``) for the analysis
upload pickers — narrower than the admin user-management routes.

Covers what used to be the hospital-scoped half of ``admin.py``: doctor/
radiologist/patient account management, doctor<->patient assignment, and
hospital-scoped analytics. Platform-wide (super_admin-only) actions live in
``platform_admin.py`` instead.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_auth_admin, get_current_user, get_database
from app.api.v1._common import (
    ROLE_PROFILE_TABLE,
    VERIFIABLE_ROLES,
    forbid,
    paginate,
    require_user,
    scope_hospital,
    scope_hospital_clinical,
)
from app.core.security import Principal
from app.schemas.common import PaginatedResponse
from app.schemas.users import (
    AssignDoctorRequest,
    AssignmentResponse,
    DoctorDirectoryEntry,
    PatientDirectoryEntry,
    Role,
    UserCreate,
    UserCreateResult,
    UserResponse,
    UserUpdate,
    VerificationResponse,
)
from app.services import permissions
from app.services.auth_admin import AuthAdminService
from app.services.database import DatabaseService
from app.services.user_provisioning import create_user_account

router = APIRouter(prefix="/hospital", tags=["hospital-admin"])


# --------------------------------------------------------------------------- #
# User accounts (doctor / radiologist / patient)
# --------------------------------------------------------------------------- #


@router.post("/users", response_model=UserCreateResult, status_code=status.HTTP_201_CREATED)
def create_hospital_user(
    payload: UserCreate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
    auth_admin: AuthAdminService = Depends(get_auth_admin),
) -> UserCreateResult:
    """Create doctor/radiologist/patient accounts only.

    Admin/super_admin accounts are created via ``POST /platform/users``
    instead — ``permissions.can_create_user_with_role`` already enforces this
    for a hospital_admin caller (who cannot create admins at all), but a
    super_admin caller is additionally blocked from using *this* route to
    create admin/super_admin so the two creation surfaces stay separated.
    """
    if payload.role.value in (Role.hospital_admin.value, Role.super_admin.value):
        raise forbid("POST /hospital/users only creates doctor, radiologist, and patient accounts.")
    result = create_user_account(payload=payload, principal=principal, db=db, auth_admin=auth_admin)
    return UserCreateResult(**result)


@router.get("/users", response_model=PaginatedResponse[UserResponse])
def list_hospital_users(
    role: str | None = Query(default=None),
    hospital_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[UserResponse]:
    scope = scope_hospital(principal, hospital_id)
    rows = db.list_user_profiles(hospital_id=scope, role=role, exclude_deleted=True)
    page, total = paginate(rows, limit=limit, offset=offset)
    return PaginatedResponse(
        items=[UserResponse(**r) for r in page], total=total, limit=limit, offset=offset
    )


@router.get("/users/{user_id}", response_model=UserResponse)
def get_hospital_user(
    user_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    user = require_user(db, user_id)
    if not permissions.can_manage_user(
        principal.role, principal.hospital_id, user.get("hospital_id"), user.get("role")
    ) and str(principal.user_id) != str(user_id):
        raise forbid("You do not have access to this user.")
    return UserResponse(**user)


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_hospital_user(
    user_id: str,
    payload: UserUpdate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    user = require_user(db, user_id)
    if not permissions.can_manage_user(
        principal.role, principal.hospital_id, user.get("hospital_id"), user.get("role")
    ):
        raise forbid("You may not modify this user.")
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = db.update_user_profile(user_id, patch)
    return UserResponse(**updated)


@router.delete("/users/{user_id}", response_model=UserResponse)
def delete_hospital_user(
    user_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    """Soft-delete a user account (terminal, distinct from suspend).

    suspended = temporary/reversible — an admin can ``POST .../reactivate``.
    deleted   = terminal — the account is hidden from directory listings
    (``GET /hospital/users``, ``/doctors``, ``/patients``) and is never
    reactivated. The row itself is kept (not hard-deleted) to preserve
    referential integrity with existing analysis_sessions and
    doctor_patient_relationships history.
    """
    user = require_user(db, user_id)
    if not permissions.can_manage_user(
        principal.role, principal.hospital_id, user.get("hospital_id"), user.get("role")
    ):
        raise forbid("You may not delete this user.")
    updated = db.update_user_profile(user_id, {"account_status": "deleted"})
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=user.get("hospital_id"),
        action="user.delete",
        target_table="user_profiles",
        target_id=user_id,
    )
    return UserResponse(**updated)


@router.post("/users/{user_id}/suspend", response_model=UserResponse)
def suspend_user(
    user_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    return _set_account_status(user_id, "suspended", principal, db)


@router.post("/users/{user_id}/reactivate", response_model=UserResponse)
def reactivate_user(
    user_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    return _set_account_status(user_id, "active", principal, db)


@router.post("/users/{user_id}/verify", response_model=VerificationResponse)
def verify_user(
    user_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> VerificationResponse:
    return _set_verification_status(user_id, "verified", principal, db)


@router.post("/users/{user_id}/reject", response_model=VerificationResponse)
def reject_user(
    user_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> VerificationResponse:
    return _set_verification_status(user_id, "rejected", principal, db)


# --------------------------------------------------------------------------- #
# Clinical directories (doctors / patients) — used by the analysis pickers
# --------------------------------------------------------------------------- #


@router.get("/doctors", response_model=PaginatedResponse[DoctorDirectoryEntry])
def list_doctors(
    hospital_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[DoctorDirectoryEntry]:
    """Doctor accounts merged with their doctor_profiles detail (doc 8.x)."""
    scope = scope_hospital_clinical(principal, hospital_id)
    users = db.list_user_profiles(hospital_id=scope, role=Role.doctor.value, exclude_deleted=True)
    profiles = {p["user_id"]: p for p in db.list_role_profiles("doctor_profiles")}
    entries = [
        DoctorDirectoryEntry(
            id=u["id"],
            hospital_id=u.get("hospital_id"),
            full_name=u["full_name"],
            email=u["email"],
            phone=u["phone"],
            account_status=u["account_status"],
            specialization=profiles.get(u["id"], {}).get("specialization"),
            medical_license=profiles.get(u["id"], {}).get("medical_license"),
            experience_years=profiles.get(u["id"], {}).get("experience_years"),
            verification_status=profiles.get(u["id"], {}).get("verification_status"),
            created_at=u.get("created_at"),
        )
        for u in users
    ]
    page, total = paginate(entries, limit=limit, offset=offset)
    return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)


@router.get("/patients", response_model=PaginatedResponse[PatientDirectoryEntry])
def list_patients(
    hospital_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[PatientDirectoryEntry]:
    """Patient accounts merged with their patient_profiles detail (doc 8.x)."""
    scope = scope_hospital_clinical(principal, hospital_id)
    users = db.list_user_profiles(hospital_id=scope, role=Role.patient.value, exclude_deleted=True)
    profiles = {p["user_id"]: p for p in db.list_role_profiles("patient_profiles")}
    entries = [
        PatientDirectoryEntry(
            id=u["id"],
            hospital_id=u.get("hospital_id"),
            full_name=u["full_name"],
            email=u["email"],
            phone=u["phone"],
            account_status=u["account_status"],
            patient_code=profiles.get(u["id"], {}).get("patient_id"),
            verification_status=profiles.get(u["id"], {}).get("verification_status"),
            created_at=u.get("created_at"),
        )
        for u in users
    ]
    page, total = paginate(entries, limit=limit, offset=offset)
    return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)


@router.get("/patients/mine", response_model=PaginatedResponse[PatientDirectoryEntry])
def list_my_patients(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[PatientDirectoryEntry]:
    """The calling doctor's own assigned patients (doc 8.x) — self-scoped, no
    hospital-wide directory access required, so a doctor can see their
    patient list without needing the broader clinical-directory permission."""
    if principal.role != Role.doctor.value:
        raise forbid("Only doctors have an assigned-patient list.")
    relationships = db.list_doctor_patient_relationships(hospital_id=principal.hospital_id)
    my_patient_ids = {
        str(r["patient_id"]) for r in relationships if str(r.get("doctor_id")) == str(principal.user_id)
    }
    entries: list[PatientDirectoryEntry] = []
    if my_patient_ids:
        users = db.list_user_profiles(
            hospital_id=principal.hospital_id, role=Role.patient.value, exclude_deleted=True
        )
        profiles = {p["user_id"]: p for p in db.list_role_profiles("patient_profiles")}
        entries = [
            PatientDirectoryEntry(
                id=u["id"],
                hospital_id=u.get("hospital_id"),
                full_name=u["full_name"],
                email=u["email"],
                phone=u["phone"],
                account_status=u["account_status"],
                patient_code=profiles.get(u["id"], {}).get("patient_id"),
                verification_status=profiles.get(u["id"], {}).get("verification_status"),
                created_at=u.get("created_at"),
            )
            for u in users
            if u["id"] in my_patient_ids
        ]
    page, total = paginate(entries, limit=limit, offset=offset)
    return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)


# --------------------------------------------------------------------------- #
# Doctor <-> patient assignments
# --------------------------------------------------------------------------- #


@router.get("/assignments", response_model=PaginatedResponse[AssignmentResponse])
def list_assignments(
    hospital_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[AssignmentResponse]:
    """Doctor-patient relationships, with names joined in for display."""
    scope = scope_hospital(principal, hospital_id)
    rows = db.list_doctor_patient_relationships(hospital_id=scope)
    users_by_id = {u["id"]: u for u in db.list_user_profiles(hospital_id=scope)}
    entries: list[AssignmentResponse] = []
    for r in rows:
        doctor = users_by_id.get(str(r.get("doctor_id")), {})
        patient = users_by_id.get(str(r.get("patient_id")), {})
        entries.append(
            AssignmentResponse(
                id=r["id"],
                doctor_id=r["doctor_id"],
                doctor_name=doctor.get("full_name", "Unknown"),
                patient_id=r["patient_id"],
                patient_name=patient.get("full_name", "Unknown"),
                hospital_id=r.get("hospital_id"),
                notes=r.get("notes"),
                created_at=r.get("created_at"),
            )
        )
    page, total = paginate(entries, limit=limit, offset=offset)
    return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)


@router.post("/assignments", status_code=status.HTTP_201_CREATED)
def create_assignment(
    payload: AssignDoctorRequest,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> dict:
    """Assign a doctor to a patient (renamed from the old
    ``POST /patients/assign-doctor`` — same behavior, same permission)."""
    patient = require_user(db, payload.patient_id)
    doctor = require_user(db, payload.doctor_id)
    hospital_id = patient.get("hospital_id")
    if doctor.get("hospital_id") != hospital_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "cross_hospital_assignment",
                "message": "Doctor and patient must belong to the same hospital.",
            },
        )
    if not permissions.can_assign_doctor_to_patient(principal.role, principal.hospital_id, hospital_id):
        raise forbid("You may not assign doctors within this hospital.")
    relationship = db.create_doctor_patient_relationship(
        {
            "doctor_id": payload.doctor_id,
            "patient_id": payload.patient_id,
            "hospital_id": hospital_id,
            "assigned_by": None if principal.is_dev else principal.user_id,
            "notes": payload.notes,
        }
    )
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=hospital_id,
        action="patient.assign_doctor",
        target_table="doctor_patient_relationships",
        target_id=relationship.get("id"),
    )
    return relationship


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_assignment(
    assignment_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> None:
    """Unassign a doctor from a patient."""
    relationship = db.get_doctor_patient_relationship(assignment_id)
    if not relationship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "assignment_not_found", "message": "Assignment not found."},
        )
    hospital_id = relationship.get("hospital_id")
    if not permissions.can_assign_doctor_to_patient(principal.role, principal.hospital_id, hospital_id):
        # 404, not 403: out-of-scope assignments are invisible to this caller
        # (same "not found" framing as require_user/require_hospital for
        # cross-hospital lookups), rather than confirming the row's existence
        # via a 403.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "assignment_not_found", "message": "Assignment not found."},
        )
    db.delete_doctor_patient_relationship(assignment_id)
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=hospital_id,
        action="patient.unassign_doctor",
        target_table="doctor_patient_relationships",
        target_id=assignment_id,
    )


# --------------------------------------------------------------------------- #
# Hospital-scoped analytics
# --------------------------------------------------------------------------- #


@router.get("/analytics")
def hospital_analytics(
    hospital_id: str | None = Query(default=None),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> dict:
    scope = scope_hospital(principal, hospital_id)
    if not scope:
        raise forbid("A hospital_id is required for this analytics view.")
    if not permissions.can_view_hospital_analytics(principal.role, principal.hospital_id, scope):
        raise forbid("You do not have access to this hospital's analytics.")
    users = db.list_user_profiles(hospital_id=scope)
    by_role: dict[str, int] = {}
    for u in users:
        by_role[u.get("role", "unknown")] = by_role.get(u.get("role", "unknown"), 0) + 1
    return {"hospital_id": scope, "total_users": len(users), "users_by_role": by_role}


def _set_account_status(
    user_id: str, account_status: str, principal: Principal, db: DatabaseService
) -> UserResponse:
    user = require_user(db, user_id)
    if not permissions.can_manage_user(
        principal.role, principal.hospital_id, user.get("hospital_id"), user.get("role")
    ):
        raise forbid("You may not change this user's account status.")
    updated = db.update_user_profile(user_id, {"account_status": account_status})
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=user.get("hospital_id"),
        action=f"user.{account_status}",
        target_table="user_profiles",
        target_id=user_id,
    )
    return UserResponse(**updated)


def _set_verification_status(
    user_id: str, verification_status: str, principal: Principal, db: DatabaseService
) -> VerificationResponse:
    user = require_user(db, user_id)
    role = user.get("role")
    if role not in VERIFIABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "not_verifiable",
                "message": f"{role} accounts have no verification status.",
            },
        )
    if not permissions.can_manage_user(
        principal.role, principal.hospital_id, user.get("hospital_id"), role
    ):
        raise forbid("You may not verify this user.")
    table = ROLE_PROFILE_TABLE[role]
    db.update_role_profile(table, user_id, {"verification_status": verification_status})
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=user.get("hospital_id"),
        action=f"user.{verification_status}",
        target_table=table,
        target_id=user_id,
    )
    return VerificationResponse(user_id=user_id, role=role, verification_status=verification_status)
