"""Platform-wide (super_admin-only) management API.

Every route here requires ``role == "super_admin"`` — enforced twice, by
design: once at route-registration time via the ``require_role("super_admin")``
router dependency (so it's visible from the route table alone, not buried in
in-function branching), and again inside each handler via the matching
``app.services.permissions`` predicate (the authorization source of truth).

Covers what used to be the super_admin-only half of ``admin.py`` plus all of
``hospitals.py``: hospital lifecycle, platform-wide analytics, the unscoped
user directory, and creating admin/super_admin accounts. Hospital-scoped
actions (available to both ``admin`` and ``super_admin``) live in
``hospital_admin.py`` instead.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_auth_admin, get_current_user, get_database, require_role
from app.api.v1._common import forbid, paginate, require_hospital
from app.core.security import Principal
from app.schemas.audit import AuditLogEntry
from app.schemas.common import PaginatedResponse
from app.schemas.users import (
    HospitalCreate,
    HospitalResponse,
    HospitalStatus,
    HospitalUpdate,
    Role,
    UserCreate,
    UserCreateResult,
    UserResponse,
)
from app.services import permissions
from app.services.auth_admin import AuthAdminService
from app.services.database import DatabaseService
from app.services.user_provisioning import create_user_account

router = APIRouter(
    prefix="/platform",
    tags=["platform-admin"],
    dependencies=[Depends(require_role("super_admin"))],
)


# --------------------------------------------------------------------------- #
# Hospitals
# --------------------------------------------------------------------------- #


@router.post("/hospitals", response_model=HospitalResponse, status_code=status.HTTP_201_CREATED)
def create_hospital(
    payload: HospitalCreate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    if not permissions.can_manage_hospitals(principal.role):
        raise forbid("Only Super Admins may create hospitals.")
    row = payload.model_dump()
    row["created_by"] = None if principal.is_dev else principal.user_id
    hospital = db.create_hospital(row)
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=hospital["id"],
        action="hospital.create",
        target_table="hospitals",
        target_id=hospital["id"],
    )
    return HospitalResponse(**hospital)


@router.get("/hospitals", response_model=PaginatedResponse[HospitalResponse])
def list_hospitals(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[HospitalResponse]:
    if not permissions.can_manage_hospitals(principal.role):
        raise forbid("Only Super Admins may list every hospital.")
    rows = db.list_hospitals()
    page, total = paginate(rows, limit=limit, offset=offset)
    return PaginatedResponse(
        items=[HospitalResponse(**r) for r in page], total=total, limit=limit, offset=offset
    )


@router.get("/hospitals/{hospital_id}", response_model=HospitalResponse)
def get_hospital(
    hospital_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    hospital = require_hospital(db, hospital_id)
    if not permissions.can_view_hospital(principal.role, principal.hospital_id, hospital_id):
        raise forbid("You do not have access to this hospital.")
    return HospitalResponse(**hospital)


@router.patch("/hospitals/{hospital_id}", response_model=HospitalResponse)
def update_hospital(
    hospital_id: str,
    payload: HospitalUpdate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    require_hospital(db, hospital_id)
    if not permissions.can_manage_hospitals(principal.role):
        raise forbid("Only Super Admins may update hospital records.")
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    hospital = db.update_hospital(hospital_id, patch)
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=hospital_id,
        action="hospital.update",
        target_table="hospitals",
        target_id=hospital_id,
        metadata=patch,
    )
    return HospitalResponse(**hospital)


@router.post("/hospitals/{hospital_id}/activate", response_model=HospitalResponse)
def activate_hospital(
    hospital_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    """Also the reactivation path from ``suspended`` — activate is not blocked
    from any prior status, so this is the real way back after a suspend."""
    return _set_hospital_status(hospital_id, HospitalStatus.active.value, principal, db)


@router.post("/hospitals/{hospital_id}/deactivate", response_model=HospitalResponse)
def deactivate_hospital(
    hospital_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    return _set_hospital_status(hospital_id, HospitalStatus.inactive.value, principal, db)


@router.post("/hospitals/{hospital_id}/suspend", response_model=HospitalResponse)
def suspend_hospital(
    hospital_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    """Explicit named replacement for the old ``DELETE /hospitals/{id}`` soft
    delete: hospitals are archived (status="suspended"), never hard-deleted,
    to preserve referential integrity with existing users/analysis sessions.
    Reverse with ``POST /hospitals/{id}/activate``."""
    return _set_hospital_status(hospital_id, HospitalStatus.suspended.value, principal, db)


def _set_hospital_status(
    hospital_id: str, status_value: str, principal: Principal, db: DatabaseService
) -> HospitalResponse:
    require_hospital(db, hospital_id)
    if not permissions.can_manage_hospitals(principal.role):
        raise forbid("Only Super Admins may change hospital status.")
    hospital = db.set_hospital_status(hospital_id, status_value)
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=hospital_id,
        action=f"hospital.{status_value}",
        target_table="hospitals",
        target_id=hospital_id,
    )
    return HospitalResponse(**hospital)


# --------------------------------------------------------------------------- #
# Platform-wide analytics
# --------------------------------------------------------------------------- #


@router.get("/analytics")
def platform_analytics(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> dict:
    if not permissions.can_view_platform_analytics(principal.role):
        raise forbid("Only Super Admins may view platform-wide analytics.")
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


# --------------------------------------------------------------------------- #
# Unscoped user directory + admin/super_admin account creation
# --------------------------------------------------------------------------- #


@router.get("/users", response_model=PaginatedResponse[UserResponse])
def list_users(
    role: str | None = Query(default=None),
    hospital_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[UserResponse]:
    """Unscoped user search/list across every hospital (super_admin only)."""
    if principal.role != "super_admin":
        raise forbid("Only Super Admins may search the platform-wide user directory.")
    rows = db.list_user_profiles(hospital_id=hospital_id, role=role)
    page, total = paginate(rows, limit=limit, offset=offset)
    return PaginatedResponse(
        items=[UserResponse(**r) for r in page], total=total, limit=limit, offset=offset
    )


@router.get("/audit-log", response_model=PaginatedResponse[AuditLogEntry])
def list_audit_log(
    hospital_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[AuditLogEntry]:
    """Read-only trail of every hospital/user management action on the
    platform — insert_audit_log() already writes to this table from the
    mutating routes above; this is the first route that reads it back."""
    if not permissions.can_view_platform_analytics(principal.role):
        raise forbid("Only Super Admins may view the audit log.")
    rows = db.list_audit_log(hospital_id=hospital_id)
    page, total = paginate(rows, limit=limit, offset=offset)
    return PaginatedResponse(
        items=[AuditLogEntry(**r) for r in page], total=total, limit=limit, offset=offset
    )


@router.post("/users", response_model=UserCreateResult, status_code=status.HTTP_201_CREATED)
def create_platform_user(
    payload: UserCreate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
    auth_admin: AuthAdminService = Depends(get_auth_admin),
) -> UserCreateResult:
    """Create admin/super_admin accounts specifically.

    Doctor/radiologist/patient accounts are created via
    ``POST /hospital/users`` instead. ``permissions.can_create_user_with_role``
    already rejects a non-super_admin target role mismatch here, but this
    route is additionally restricted to admin/super_admin targets so the two
    creation surfaces stay clearly separated.
    """
    if payload.role.value not in (Role.hospital_admin.value, Role.super_admin.value):
        raise forbid("POST /platform/users only creates admin or super_admin accounts.")
    result = create_user_account(payload=payload, principal=principal, db=db, auth_admin=auth_admin)
    return UserCreateResult(**result)
