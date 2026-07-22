"""User endpoints (doc 5.1 / 14.8)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_database
from app.core.security import Principal
from app.schemas.users import (
    BloodGroupResponse,
    QualificationResponse,
    UserResponse,
    UserUpdate,
)
from app.services.database import DatabaseService
from app.api.v1._common import ROLE_FIELD_MAP as _ROLE_FIELD_MAP
from app.api.v1._common import ROLE_PROFILE_TABLE

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/blood-groups", response_model=list[BloodGroupResponse])
def list_blood_groups(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> list[BloodGroupResponse]:
    """Lookup list for the patient profile's blood-group picker."""
    return [BloodGroupResponse(**row) for row in db.list_blood_groups()]


@router.get("/qualifications", response_model=list[QualificationResponse])
def list_qualifications(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> list[QualificationResponse]:
    """Lookup list for the doctor/radiologist profile's qualification picker."""
    return [QualificationResponse(**row) for row in db.list_qualifications()]


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


def _resolve_role_lookups(db: DatabaseService, role: str, role_detail: dict) -> dict:
    """Fill in human-readable names for FK columns the frontend needs to
    display (blood_type for patients, qualification_name for doctor/
    radiologist) without a second round-trip from the client."""
    qualification_id = role_detail.get("qualification_id")
    if qualification_id is not None and role in ("doctor", "radiologist"):
        qualification = next(
            (q for q in db.list_qualifications() if q["id"] == qualification_id), None
        )
        if qualification:
            role_detail = {**role_detail, "qualification_name": qualification["qualification_name"]}

    if role == "patient":
        blood_group_id = role_detail.get("blood_group_id")
        if blood_group_id is not None:
            blood_group = next(
                (g for g in db.list_blood_groups() if g["id"] == blood_group_id), None
            )
            if blood_group:
                role_detail = {**role_detail, "blood_type": blood_group["blood_type"]}

    return role_detail


@router.get("/me", response_model=UserResponse)
def get_me(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> UserResponse:
    """Return the caller's canonical backend profile with roleProfile detail bag."""
    profile = db.get_user_profile(principal.user_id) or principal.profile or {}
    role = principal.role or ""
    role_table = ROLE_PROFILE_TABLE.get(role)
    role_detail = {}
    if role_table:
        res = db.client.table(role_table).select("*").eq("user_id", principal.user_id).maybe_single().execute()
        role_detail = getattr(res, "data", None) or {}

    if role == "patient":
        role_detail = {**role_detail, **_patient_care_team_detail(db, principal.user_id, principal.hospital_id)}

    # date_of_birth lives on user_profiles (not the role-detail tables); surface
    # it into the roleProfile bag so patient-facing views (e.g. the simple
    # patient report) can show a real DOB/age instead of a blank.
    if profile.get("date_of_birth") is not None:
        role_detail = {**role_detail, "date_of_birth": profile.get("date_of_birth")}

    # The hospital association lives on user_profiles (not the role-detail
    # tables), so surface both the id and the resolved name into the roleProfile
    # bag. Without this the caller's own profile page had no hospital_id to look
    # up and always rendered "Not provided" for every role's Hospital field.
    hospital_id = profile.get("hospital_id") or principal.hospital_id
    if hospital_id:
        role_detail = {**role_detail, "hospital_id": hospital_id}
        hospital = db.get_hospital(hospital_id)
        if hospital and hospital.get("name"):
            role_detail = {**role_detail, "hospital_name": hospital["name"]}

    role_detail = _resolve_role_lookups(db, role, role_detail)

    merged_profile = {**profile, "roleProfile": role_detail}
    return UserResponse(
        id=principal.user_id,
        hospital_id=hospital_id,
        unique_identifier=profile.get("unique_identifier", ""),
        full_name=profile.get("full_name", ""),
        email=principal.email or profile.get("email", "") or "",
        phone=profile.get("phone", ""),
        avatar_url=profile.get("avatar_url"),
        role=role,
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
    """Update the caller's profile and role-specific details.

    Role-specific fields are mapped through `_ROLE_FIELD_MAP` so this only
    ever writes columns that actually exist on the caller's role table —
    sending an unknown column to Supabase's `.upsert()` fails the *entire*
    statement, which previously meant one bad field (e.g. the old free-text
    "qualification") silently blocked every other field in the same save.
    """
    data = payload.model_dump(exclude_unset=True)

    user_profile_keys = {"full_name", "phone", "address", "avatar_url"}
    user_patch = {k: v for k, v in data.items() if k in user_profile_keys and v is not None}

    role = principal.role or ""
    field_map = _ROLE_FIELD_MAP.get(role, {})
    role_patch = {
        column: data[field]
        for field, column in field_map.items()
        if data.get(field) is not None
    }

    if user_patch:
        db.update_user_profile(principal.user_id, user_patch)

    role_table = ROLE_PROFILE_TABLE.get(role)
    if role_table and role_patch:
        db.upsert_role_profile(role_table, principal.user_id, role_patch)

    return get_me(principal=principal, db=db)
