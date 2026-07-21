"""User endpoints (doc 5.1 / 14.8)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_database
from app.core.security import Principal
from app.schemas.users import BloodGroupResponse, UserResponse, UserUpdate
from app.services.database import DatabaseService
from app.api.v1._common import ROLE_PROFILE_TABLE

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/blood-groups", response_model=list[BloodGroupResponse])
def list_blood_groups(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> list[BloodGroupResponse]:
    """Lookup list for the patient profile's blood-group picker."""
    return [BloodGroupResponse(**row) for row in db.list_blood_groups()]


def _patient_care_team_detail(db: DatabaseService, patient_user_id: str, hospital_id: str | None) -> dict:
    """Best-effort assigned-doctor name for a patient's own profile.

    ``patient_profiles.assigned_doctor_id`` is never actually written by the
    assignment flow (``POST /hospital/assignments`` only inserts into
    ``doctor_patient_relationships``), so it can't be trusted — this reads
    the real source of truth instead and resolves the doctor's display name.
    """
    relationships = db.list_doctor_patient_relationships(hospital_id=hospital_id)
    mine = [
        r
        for r in relationships
        if str(r.get("patient_id")) == str(patient_user_id) and r.get("relationship_status") == "active"
    ]
    if not mine:
        return {}
    mine.sort(key=lambda r: str(r.get("assigned_at") or ""), reverse=True)
    doctor = db.get_user_profile(str(mine[0]["doctor_id"]))
    if not doctor:
        return {}
    return {"assigned_doctor_id": doctor["id"], "assigned_doctor_name": doctor.get("full_name")}


@router.get("/me", response_model=UserResponse)
def get_me(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    """Return the caller's canonical backend profile with roleProfile detail bag."""
    profile = db.get_user_profile(principal.user_id) or principal.profile or {}
    role_table = ROLE_PROFILE_TABLE.get(principal.role or "")
    role_detail = {}
    if role_table:
        res = db.client.table(role_table).select("*").eq("user_id", principal.user_id).maybe_single().execute()
        role_detail = getattr(res, "data", None) or {}

    if principal.role == "patient":
        role_detail = {**role_detail, **_patient_care_team_detail(db, principal.user_id, principal.hospital_id)}
        blood_group_id = role_detail.get("blood_group_id")
        if blood_group_id is not None:
            blood_group = next(
                (g for g in db.list_blood_groups() if g["id"] == blood_group_id), None
            )
            if blood_group:
                role_detail["blood_type"] = blood_group["blood_type"]

    merged_profile = {**profile, "roleProfile": role_detail}
    return UserResponse(
        id=principal.user_id,
        hospital_id=principal.hospital_id,
        unique_identifier=profile.get("unique_identifier", ""),
        full_name=profile.get("full_name", ""),
        email=principal.email or profile.get("email", "") or "",
        phone=profile.get("phone", ""),
        avatar_url=profile.get("avatar_url"),
        role=principal.role or "",
        account_status=principal.status or ("active" if principal.is_dev else ""),
        created_at=profile.get("created_at"),
        updated_at=profile.get("updated_at"),
        profile=merged_profile,
    )


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    """Update the caller's profile and role-specific details."""
    data = payload.model_dump(exclude_unset=True)

    # 1. Separate user_profiles fields vs role_profile fields
    user_profile_keys = {"full_name", "phone", "address", "avatar_url"}
    user_patch = {k: v for k, v in data.items() if k in user_profile_keys and v is not None}
    role_patch = {k: v for k, v in data.items() if k not in user_profile_keys and v is not None}

    # Normalize aliases for DB column compatibility
    if "license_number" in role_patch:
        role_patch["medical_license"] = role_patch["license_number"]
    if "medical_license" in role_patch:
        role_patch["license_number"] = role_patch["medical_license"]

    if "experience_years" in role_patch:
        role_patch["years_of_experience"] = role_patch["experience_years"]
    if "years_of_experience" in role_patch:
        role_patch["experience_years"] = role_patch["years_of_experience"]

    if user_patch:
        db.update_user_profile(principal.user_id, user_patch)

    role_table = ROLE_PROFILE_TABLE.get(principal.role or "")
    if role_table and role_patch:
        db.upsert_role_profile(role_table, principal.user_id, role_patch)

    return get_me(principal=principal, db=db)
