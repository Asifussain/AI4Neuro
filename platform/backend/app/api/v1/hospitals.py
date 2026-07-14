"""Hospital management API (Super Admin platform-wide; Hospital Admin read-only self).

Super Admin creates/updates/activates/deactivates/deletes hospitals and can view
every hospital. Hospital Admin may only read their own hospital's record.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, get_database
from app.core.security import Principal
from app.schemas.users import HospitalCreate, HospitalResponse, HospitalStatus, HospitalUpdate
from app.services import permissions
from app.services.database import DatabaseService

router = APIRouter(prefix="/hospitals", tags=["hospitals"])


@router.post("", response_model=HospitalResponse, status_code=status.HTTP_201_CREATED)
def create_hospital(
    payload: HospitalCreate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    if not permissions.can_manage_hospitals(principal.role):
        raise _forbid("Only Super Admins may create hospitals.")
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


@router.get("", response_model=list[HospitalResponse])
def list_hospitals(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> list[HospitalResponse]:
    if principal.role == "super_admin":
        rows = db.list_hospitals()
    elif principal.role == "hospital_admin" and principal.hospital_id:
        hospital = db.get_hospital(principal.hospital_id)
        rows = [hospital] if hospital else []
    else:
        raise _forbid("You do not have access to hospital records.")
    return [HospitalResponse(**r) for r in rows]


@router.get("/{hospital_id}", response_model=HospitalResponse)
def get_hospital(
    hospital_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    hospital = _require_hospital(db, hospital_id)
    if not permissions.can_view_hospital(principal.role, principal.hospital_id, hospital_id):
        raise _forbid("You do not have access to this hospital.")
    return HospitalResponse(**hospital)


@router.patch("/{hospital_id}", response_model=HospitalResponse)
def update_hospital(
    hospital_id: str,
    payload: HospitalUpdate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    _require_hospital(db, hospital_id)
    if not permissions.can_manage_hospitals(principal.role):
        raise _forbid("Only Super Admins may update hospital records.")
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


@router.post("/{hospital_id}/activate", response_model=HospitalResponse)
def activate_hospital(
    hospital_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    return _set_status(hospital_id, HospitalStatus.active.value, principal, db)


@router.post("/{hospital_id}/deactivate", response_model=HospitalResponse)
def deactivate_hospital(
    hospital_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    return _set_status(hospital_id, HospitalStatus.inactive.value, principal, db)


@router.delete("/{hospital_id}", response_model=HospitalResponse)
def delete_hospital(
    hospital_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalResponse:
    """Soft delete: hospitals are archived (status), never hard-deleted, to
    preserve referential integrity with existing users/analysis sessions."""
    _require_hospital(db, hospital_id)
    if not permissions.can_manage_hospitals(principal.role):
        raise _forbid("Only Super Admins may delete hospitals.")
    hospital = db.set_hospital_status(hospital_id, "suspended")
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=hospital_id,
        action="hospital.delete",
        target_table="hospitals",
        target_id=hospital_id,
    )
    return HospitalResponse(**hospital)


def _set_status(
    hospital_id: str, status_value: str, principal: Principal, db: DatabaseService
) -> HospitalResponse:
    _require_hospital(db, hospital_id)
    if not permissions.can_manage_hospitals(principal.role):
        raise _forbid("Only Super Admins may change hospital status.")
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


def _require_hospital(db: DatabaseService, hospital_id: str) -> dict:
    hospital = db.get_hospital(hospital_id)
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "hospital_not_found", "message": "Hospital not found."},
        )
    return hospital


def _forbid(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "permission_denied", "message": message},
    )
