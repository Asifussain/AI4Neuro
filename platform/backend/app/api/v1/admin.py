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
    AssignmentResponse,
    DoctorDirectoryEntry,
    PatientDirectoryEntry,
    PlatformSettingsResponse,
    PlatformSettingsUpdate,
    Role,
    UserCreate,
    UserResponse,
    UserUpdate,
    VerificationResponse,
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

# Only these role-detail tables carry a verification_status column.
_VERIFIABLE_ROLES = {Role.doctor.value, Role.radiologist.value, Role.patient.value}


def _scope_hospital(principal: Principal, hospital_id: str | None) -> str | None:
    """Resolve the effective hospital filter for the admin user directory.

    super_admin may pass an optional cross-hospital filter; hospital_admin is
    pinned to their own hospital. Other roles are denied.
    """
    if principal.role == "super_admin":
        return hospital_id
    if principal.role == "admin":
        return principal.hospital_id
    raise _forbid("You do not have access to this directory.")


# Roles allowed to browse the clinical directories (doctors / patients) so they
# can attach a patient/doctor when starting an analysis. Wider than the admin
# user directory, but still hospital-scoped for every non-super_admin caller.
_CLINICAL_DIRECTORY_ROLES = {"super_admin", "admin", "doctor", "radiologist"}


def _scope_hospital_clinical(principal: Principal, hospital_id: str | None) -> str | None:
    """Hospital filter for the doctor/patient pickers used by the analysis flow."""
    if principal.role not in _CLINICAL_DIRECTORY_ROLES:
        raise _forbid("You do not have access to this directory.")
    if principal.role == "super_admin":
        return hospital_id
    return principal.hospital_id


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    target_role = payload.role.value
    target_hospital_id = payload.hospital_id if target_role != "super_admin" else None

    if principal.role == "admin":
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
    scope_hospital = _scope_hospital(principal, hospital_id)
    rows = db.list_user_profiles(hospital_id=scope_hospital, role=role)
    return [UserResponse(**r) for r in rows]


@router.get("/doctors", response_model=list[DoctorDirectoryEntry])
def list_doctors(
    hospital_id: str | None = Query(default=None),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> list[DoctorDirectoryEntry]:
    """Doctor accounts merged with their doctor_profiles detail (doc 8.x)."""
    scope_hospital = _scope_hospital_clinical(principal, hospital_id)
    users = db.list_user_profiles(hospital_id=scope_hospital, role=Role.doctor.value)
    profiles = {p["user_id"]: p for p in db.list_role_profiles("doctor_profiles")}
    return [
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


@router.get("/patients", response_model=list[PatientDirectoryEntry])
def list_patients(
    hospital_id: str | None = Query(default=None),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> list[PatientDirectoryEntry]:
    """Patient accounts merged with their patient_profiles detail (doc 8.x)."""
    scope_hospital = _scope_hospital_clinical(principal, hospital_id)
    users = db.list_user_profiles(hospital_id=scope_hospital, role=Role.patient.value)
    profiles = {p["user_id"]: p for p in db.list_role_profiles("patient_profiles")}
    return [
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


@router.get("/patients/mine", response_model=list[PatientDirectoryEntry])
def list_my_patients(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> list[PatientDirectoryEntry]:
    """The calling doctor's own assigned patients (doc 8.x) — self-scoped, no
    hospital-wide directory access required, so a doctor can see their
    patient list without needing the broader clinical-directory permission."""
    if principal.role != Role.doctor.value:
        raise _forbid("Only doctors have an assigned-patient list.")
    relationships = db.list_doctor_patient_relationships(hospital_id=principal.hospital_id)
    my_patient_ids = {
        str(r["patient_id"]) for r in relationships if str(r.get("doctor_id")) == str(principal.user_id)
    }
    if not my_patient_ids:
        return []
    users = db.list_user_profiles(hospital_id=principal.hospital_id, role=Role.patient.value)
    profiles = {p["user_id"]: p for p in db.list_role_profiles("patient_profiles")}
    return [
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


@router.get("/assignments", response_model=list[AssignmentResponse])
def list_assignments(
    hospital_id: str | None = Query(default=None),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> list[AssignmentResponse]:
    """Doctor-patient relationships, with names joined in for display."""
    scope_hospital = _scope_hospital(principal, hospital_id)
    rows = db.list_doctor_patient_relationships(hospital_id=scope_hospital)
    users_by_id = {u["id"]: u for u in db.list_user_profiles(hospital_id=scope_hospital)}
    out: list[AssignmentResponse] = []
    for r in rows:
        doctor = users_by_id.get(str(r.get("doctor_id")), {})
        patient = users_by_id.get(str(r.get("patient_id")), {})
        out.append(
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
    return out


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


def _set_verification_status(
    user_id: str, verification_status: str, principal: Principal, db: DatabaseService
) -> VerificationResponse:
    user = _require_user(db, user_id)
    role = user.get("role")
    if role not in _VERIFIABLE_ROLES:
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
        raise _forbid("You may not verify this user.")
    table = _ROLE_PROFILE_TABLE[role]
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
