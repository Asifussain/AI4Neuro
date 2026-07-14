"""User management API (Super Admin platform-wide; Hospital Admin single-tenant).

Hospital Admin may only create/view/manage doctors, radiologists, and patients
within their own hospital. Super Admin may do so across every hospital, and may
additionally create Hospital Admins and other Super Admins.

Note: this creates the ``user_profiles`` row (and role-detail row) for accounts
provisioned by an admin. Supabase Auth user creation (email/password) happens on
the frontend via the service-role client (see
``frontend/src/app/api/admin/create-user``), which then calls this API — or,
where Supabase Auth isn't reachable from the backend process, the frontend route
alone — to keep the two in sync. See doc for the full flow.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user, get_database
from app.core.security import Principal
from app.schemas.users import (
    AssignDoctorRequest,
    PlatformSettingsResponse,
    PlatformSettingsUpdate,
    Role,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.services import permissions
from app.services.database import DatabaseService

router = APIRouter(tags=["admin"])

_ROLE_PROFILE_TABLE = {
    Role.hospital_admin.value: "hospital_admin_profiles",
    Role.doctor.value: "doctor_profiles",
    Role.radiologist.value: "radiologist_profiles",
    Role.patient.value: "patient_profiles",
    Role.super_admin.value: "super_admin_profiles",
}


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    target_role = payload.role.value
    target_hospital_id = payload.hospital_id if target_role != "super_admin" else None

    if principal.role == "hospital_admin":
        # A hospital_admin may only create into their own hospital.
        target_hospital_id = principal.hospital_id

    if not permissions.can_create_user_with_role(
        principal.role,
        target_role,
        actor_hospital_id=principal.hospital_id,
        target_hospital_id=target_hospital_id,
    ):
        raise _forbid(f"Your role may not create a {target_role} account.")

    if target_role != "super_admin" and not target_hospital_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "hospital_required", "message": "hospital_id is required for this role."},
        )

    row = {
        "hospital_id": target_hospital_id,
        "unique_identifier": payload.unique_identifier,
        "full_name": payload.full_name,
        "email": payload.email,
        "phone": payload.phone,
        "date_of_birth": payload.date_of_birth,
        "address": payload.address,
        "role": target_role,
        "account_status": "active",
        "created_by_admin": None if principal.is_dev else principal.user_id,
    }
    user = db.create_user_profile(row)

    profile_table = _ROLE_PROFILE_TABLE.get(target_role)
    if profile_table:
        db.create_role_profile(profile_table, {"user_id": user["id"]})

    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=target_hospital_id,
        action="user.create",
        target_table="user_profiles",
        target_id=user["id"],
        metadata={"role": target_role},
    )
    return UserResponse(**user)


@router.get("/users", response_model=list[UserResponse])
def list_users(
    role: str | None = Query(default=None),
    hospital_id: str | None = Query(default=None),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> list[UserResponse]:
    if principal.role == "super_admin":
        scope_hospital = hospital_id  # optional cross-hospital filter
    elif principal.role == "hospital_admin":
        scope_hospital = principal.hospital_id
    else:
        raise _forbid("You do not have access to the user directory.")
    rows = db.list_user_profiles(hospital_id=scope_hospital, role=role)
    return [UserResponse(**r) for r in rows]


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    user = _require_user(db, user_id)
    if not permissions.can_manage_user(
        principal.role, principal.hospital_id, user.get("hospital_id"), user.get("role")
    ) and str(principal.user_id) != str(user_id):
        raise _forbid("You do not have access to this user.")
    return UserResponse(**user)


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    payload: UserUpdate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    user = _require_user(db, user_id)
    if not permissions.can_manage_user(
        principal.role, principal.hospital_id, user.get("hospital_id"), user.get("role")
    ):
        raise _forbid("You may not modify this user.")
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = db.update_user_profile(user_id, patch)
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


@router.post("/patients/assign-doctor", status_code=status.HTTP_201_CREATED)
def assign_doctor(
    payload: AssignDoctorRequest,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> dict:
    patient = _require_user(db, payload.patient_id)
    doctor = _require_user(db, payload.doctor_id)
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
        raise _forbid("You may not assign doctors within this hospital.")
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


@router.get("/analytics/platform")
def platform_analytics(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> dict:
    if not permissions.can_view_platform_analytics(principal.role):
        raise _forbid("Only Super Admins may view platform-wide analytics.")
    hospitals = db.list_hospitals()
    users = db.list_user_profiles()
    by_role: dict[str, int] = {}
    for u in users:
        by_role[u.get("role", "unknown")] = by_role.get(u.get("role", "unknown"), 0) + 1
    return {
        "total_hospitals": len(hospitals),
        "active_hospitals": sum(1 for h in hospitals if h.get("status") == "active"),
        "total_users": len(users),
        "users_by_role": by_role,
    }


@router.get("/analytics/hospital/{hospital_id}")
def hospital_analytics(
    hospital_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> dict:
    if not permissions.can_view_hospital_analytics(principal.role, principal.hospital_id, hospital_id):
        raise _forbid("You do not have access to this hospital's analytics.")
    users = db.list_user_profiles(hospital_id=hospital_id)
    by_role: dict[str, int] = {}
    for u in users:
        by_role[u.get("role", "unknown")] = by_role.get(u.get("role", "unknown"), 0) + 1
    return {"hospital_id": hospital_id, "total_users": len(users), "users_by_role": by_role}


@router.get("/settings", response_model=PlatformSettingsResponse)
def get_settings(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PlatformSettingsResponse:
    if not permissions.can_manage_platform_settings(principal.role):
        raise _forbid("Only Super Admins may view platform settings.")
    res = db.client.table("platform_settings").select("*").eq("id", True).maybe_single().execute()
    row = getattr(res, "data", None) or {"settings": {}}
    return PlatformSettingsResponse(**row)


@router.patch("/settings", response_model=PlatformSettingsResponse)
def update_settings(
    payload: PlatformSettingsUpdate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PlatformSettingsResponse:
    if not permissions.can_manage_platform_settings(principal.role):
        raise _forbid("Only Super Admins may update platform settings.")
    patch = {
        "settings": payload.settings,
        "updated_by": None if principal.is_dev else principal.user_id,
    }
    db.client.table("platform_settings").update(patch).eq("id", True).execute()
    res = db.client.table("platform_settings").select("*").eq("id", True).maybe_single().execute()
    row = getattr(res, "data", None) or {"settings": payload.settings}
    return PlatformSettingsResponse(**row)


def _set_account_status(
    user_id: str, account_status: str, principal: Principal, db: DatabaseService
) -> UserResponse:
    user = _require_user(db, user_id)
    if not permissions.can_manage_user(
        principal.role, principal.hospital_id, user.get("hospital_id"), user.get("role")
    ):
        raise _forbid("You may not change this user's account status.")
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


def _require_user(db: DatabaseService, user_id: str) -> dict:
    user = db.get_user_profile(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "user_not_found", "message": "User not found."},
        )
    return user


def _forbid(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "permission_denied", "message": message},
    )
