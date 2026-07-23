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

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_auth_admin, get_current_user, get_database, require_role
from app.api.v1._common import forbid, paginate, require_hospital, require_user
from app.core.security import Principal
from app.schemas.admin_detail import (
    DoctorProfileDetail,
    HospitalAdminProfileDetail,
    PatientBrief,
    PatientProfileDetail,
    RadiologistProfileDetail,
)
from app.schemas.analysis import ScanRow, SessionStatusResponse
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


def _not_found(role_label: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "not_found", "message": f"{role_label} not found."},
    )


def _to_session_status(session: dict) -> SessionStatusResponse:
    return SessionStatusResponse(
        id=str(session["id"]),
        modality=session["modality"],
        analysis_type=session["analysis_type"],
        patient_id=str(session.get("patient_id")) if session.get("patient_id") else None,
        doctor_id=str(session.get("doctor_id")) if session.get("doctor_id") else None,
        status=session["status"],
        current_stage=session.get("current_stage"),
        progress_percent=session.get("progress_percent", 0) or 0,
        error_message=session.get("error_message"),
        created_at=session.get("created_at"),
        updated_at=session.get("updated_at"),
    )


def _patient_name_map(db: DatabaseService, sessions: list[dict]) -> dict[str, str]:
    """patient_id -> full_name for the patients in the given sessions, so the
    drill-down UIs can render real patient names next to each session instead
    of a placeholder."""
    ids = {str(s["patient_id"]) for s in sessions if s.get("patient_id")}
    names: dict[str, str] = {}
    for pid in ids:
        user = db.get_user_profile(pid)
        if user and user.get("full_name"):
            names[pid] = user["full_name"]
    return names


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
    """Archive a hospital (status="suspended") AND cascade-suspend every user
    under it so none of them can log in until the hospital is reactivated.
    Reverse with ``POST /hospitals/{id}/activate`` (which restores the users)."""
    return _set_hospital_status(hospital_id, HospitalStatus.suspended.value, principal, db)


@router.delete("/hospitals/{hospital_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_hospital(
    hospital_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
    auth_admin: AuthAdminService = Depends(get_auth_admin),
) -> None:
    """Permanently delete a hospital and EVERYTHING scoped to it.

    This is a true hard delete, distinct from ``/suspend`` (which is a
    reversible login block): the hospital row is removed from the platform
    entirely, along with every account under it (hospital admins, doctors,
    radiologists, patients) — their user_profiles + role-detail rows, their
    Supabase Auth login accounts, their analysis sessions/results/reports, and
    the hospital's doctor-patient relationships and audit trail. Nothing
    remains and it cannot be undone."""
    require_hospital(db, hospital_id)
    if not permissions.can_manage_hospitals(principal.role):
        raise forbid("Only Super Admins may delete hospitals.")

    deleted_user_ids = db.hard_delete_hospital(hospital_id)

    # Remove the Supabase Auth login accounts too (best-effort per user — a
    # missing/already-gone account must not fail the overall delete).
    for uid in deleted_user_ids:
        auth_admin.delete_auth_user(uid)

    # Audit the deletion with hospital_id=None (the hospital row no longer
    # exists, so a hospital-scoped FK would dangle); actor is the super_admin.
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=None,
        action="hospital.delete",
        target_table="hospitals",
        target_id=hospital_id,
        metadata={"deleted_users": len(deleted_user_ids)},
    )
    return None


def _set_hospital_status(
    hospital_id: str, status_value: str, principal: Principal, db: DatabaseService
) -> HospitalResponse:
    require_hospital(db, hospital_id)
    if not permissions.can_manage_hospitals(principal.role):
        raise forbid("Only Super Admins may change hospital status.")
    hospital = db.set_hospital_status(hospital_id, status_value)

    # Cascade the hospital's lifecycle onto its users' login access:
    #   * suspend / deactivate -> block every (non-deleted) user's login.
    #   * activate            -> restore users that a hospital action put down
    #                            (suspended/inactive), never a terminally
    #                            deleted account.
    cascaded = None
    if status_value in (HospitalStatus.suspended.value, HospitalStatus.inactive.value):
        cascaded = db.set_hospital_users_status(hospital_id, "suspended")
    elif status_value == HospitalStatus.active.value:
        cascaded = db.set_hospital_users_status(
            hospital_id, "active", only_from_statuses=["suspended", "inactive"]
        )

    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=hospital_id,
        action=f"hospital.{status_value}",
        target_table="hospitals",
        target_id=hospital_id,
        metadata={"cascaded_users": cascaded} if cascaded is not None else None,
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
# Platform-wide scan directory ("View Scans")
# --------------------------------------------------------------------------- #


@router.get("/scans", response_model=PaginatedResponse[ScanRow])
def list_scans(
    modality: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    hospital_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[ScanRow]:
    """Every analysis session across the whole platform, enriched with patient /
    doctor / radiologist / hospital display names for the Super Admin's
    "View Scans" table. super_admin-only (router-level guard)."""
    if not permissions.can_view_platform_analytics(principal.role):
        raise forbid("Only Super Admins may view every scan on the platform.")

    rows = db.list_sessions(modality=modality, status=status_filter, hospital_id=hospital_id)
    rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)

    # Resolve ids -> names once (small per-platform scale), rather than per row.
    user_names = {u["id"]: u.get("full_name") for u in db.list_user_profiles()}
    hospital_names = {h["id"]: h.get("name") for h in db.list_hospitals()}

    def _name(uid) -> str | None:
        return user_names.get(str(uid)) if uid else None

    scans = [
        ScanRow(
            id=str(r["id"]),
            modality=r["modality"],
            analysis_type=r["analysis_type"],
            status=r["status"],
            created_at=r.get("created_at"),
            patient_id=str(r["patient_id"]) if r.get("patient_id") else None,
            patient_name=_name(r.get("patient_id")),
            doctor_id=str(r["doctor_id"]) if r.get("doctor_id") else None,
            doctor_name=_name(r.get("doctor_id")),
            radiologist_id=str(r["radiologist_id"]) if r.get("radiologist_id") else None,
            radiologist_name=_name(r.get("radiologist_id")),
            hospital_id=str(r["hospital_id"]) if r.get("hospital_id") else None,
            hospital_name=hospital_names.get(str(r.get("hospital_id"))) if r.get("hospital_id") else None,
            uploaded_by_role=r.get("uploaded_by_role"),
        )
        for r in rows
    ]
    page, total = paginate(scans, limit=limit, offset=offset)
    return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)


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


# --------------------------------------------------------------------------- #
# Drill-down profile pages — Super Admin's read-only "view everything about
# this one person/hospital" detail views. There was previously no
# single-entity detail endpoint anywhere (only paginated directory lists);
# permissions.can_read_session/can_view_hospital already grant super_admin
# unconditional cross-hospital read access, so no new permission predicates
# are needed — the router-level require_role("super_admin") dependency is
# the gate.
# --------------------------------------------------------------------------- #


def _qualification_name(db: DatabaseService, qualification_id: int | None) -> str | None:
    if qualification_id is None:
        return None
    match = next((q for q in db.list_qualifications() if q["id"] == qualification_id), None)
    return match["qualification_name"] if match else None


def _blood_type(db: DatabaseService, blood_group_id: int | None) -> str | None:
    if blood_group_id is None:
        return None
    match = next((g for g in db.list_blood_groups() if g["id"] == blood_group_id), None)
    return match["blood_type"] if match else None


@router.get("/doctors/{doctor_id}", response_model=DoctorProfileDetail)
def get_doctor_detail(
    doctor_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> DoctorProfileDetail:
    user = require_user(db, doctor_id)
    if user.get("role") != Role.doctor.value:
        raise _not_found("Doctor")

    profile_res = db.client.table("doctor_profiles").select("*").eq("user_id", doctor_id).maybe_single().execute()
    profile = getattr(profile_res, "data", None) or {}

    hospital_id = user.get("hospital_id")
    hospital = db.get_hospital(hospital_id) if hospital_id else None
    hospital_admin_name = None
    if hospital_id:
        admins = db.list_user_profiles(hospital_id=hospital_id, role=Role.hospital_admin.value, exclude_deleted=True)
        if admins:
            hospital_admin_name = admins[0].get("full_name")

    relationships = db.list_doctor_patient_relationships(doctor_id=doctor_id)
    active_patient_ids = {
        str(r["patient_id"]) for r in relationships if r.get("relationship_status") == "active"
    }
    hospital_patients = (
        db.list_user_profiles(hospital_id=hospital_id, role=Role.patient.value, exclude_deleted=True)
        if hospital_id
        else []
    )
    patient_codes = {p["user_id"]: p.get("patient_id") for p in db.list_role_profiles("patient_profiles")}
    patients = [
        PatientBrief(
            id=p["id"],
            full_name=p["full_name"],
            email=p["email"],
            patient_code=patient_codes.get(p["id"]),
            account_status=p["account_status"],
        )
        for p in hospital_patients
        if p["id"] in active_patient_ids
    ]

    sessions = db.list_sessions(doctor_id=doctor_id)
    sessions.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)

    return DoctorProfileDetail(
        id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        phone=user["phone"],
        avatar_url=user.get("avatar_url"),
        account_status=user["account_status"],
        created_at=user.get("created_at"),
        hospital_id=hospital_id,
        hospital_name=hospital["name"] if hospital else None,
        hospital_admin_name=hospital_admin_name,
        medical_license=profile.get("medical_license"),
        specialization=profile.get("specialization"),
        qualification_name=_qualification_name(db, profile.get("qualification_id")),
        experience_years=profile.get("experience_years"),
        verification_status=profile.get("verification_status"),
        patient_count=len(patients),
        patients=patients,
        mri_count=sum(1 for s in sessions if s.get("modality") == "mri"),
        eeg_count=sum(1 for s in sessions if s.get("modality") == "eeg"),
        pending_reports=sum(1 for s in sessions if s.get("status") in ("queued", "processing")),
        completed_reports=sum(1 for s in sessions if s.get("status") == "completed"),
        recent_sessions=[_to_session_status(s) for s in sessions[:10]],
        patient_names=_patient_name_map(db, sessions[:10]),
    )


@router.get("/radiologists/{radiologist_id}", response_model=RadiologistProfileDetail)
def get_radiologist_detail(
    radiologist_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> RadiologistProfileDetail:
    user = require_user(db, radiologist_id)
    if user.get("role") != Role.radiologist.value:
        raise _not_found("Radiologist")

    profile_res = (
        db.client.table("radiologist_profiles").select("*").eq("user_id", radiologist_id).maybe_single().execute()
    )
    profile = getattr(profile_res, "data", None) or {}

    hospital_id = user.get("hospital_id")
    hospital = db.get_hospital(hospital_id) if hospital_id else None

    sessions = db.list_sessions(radiologist_id=radiologist_id)
    sessions.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)

    return RadiologistProfileDetail(
        id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        phone=user["phone"],
        avatar_url=user.get("avatar_url"),
        account_status=user["account_status"],
        created_at=user.get("created_at"),
        hospital_id=hospital_id,
        hospital_name=hospital["name"] if hospital else None,
        radiologist_license=profile.get("radiologist_license"),
        imaging_expertise=profile.get("imaging_expertise"),
        certifications=profile.get("certifications"),
        qualification_name=_qualification_name(db, profile.get("qualification_id")),
        experience_years=profile.get("experience_years"),
        verification_status=profile.get("verification_status"),
        mri_count=sum(1 for s in sessions if s.get("modality") == "mri"),
        eeg_count=sum(1 for s in sessions if s.get("modality") == "eeg"),
        pending_reports=sum(1 for s in sessions if s.get("status") in ("queued", "processing")),
        completed_reports=sum(1 for s in sessions if s.get("status") == "completed"),
        recent_sessions=[_to_session_status(s) for s in sessions[:10]],
        patient_names=_patient_name_map(db, sessions[:10]),
    )


@router.get("/patients/{patient_id}", response_model=PatientProfileDetail)
def get_patient_detail(
    patient_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PatientProfileDetail:
    user = require_user(db, patient_id)
    if user.get("role") != Role.patient.value:
        raise _not_found("Patient")

    profile_res = db.client.table("patient_profiles").select("*").eq("user_id", patient_id).maybe_single().execute()
    profile = getattr(profile_res, "data", None) or {}

    hospital_id = user.get("hospital_id")
    hospital = db.get_hospital(hospital_id) if hospital_id else None

    relationships = [
        r
        for r in db.list_doctor_patient_relationships(patient_id=patient_id)
        if r.get("relationship_status") == "active"
    ]
    relationships.sort(key=lambda r: str(r.get("assigned_at") or ""), reverse=True)
    assigned_doctor_id = str(relationships[0]["doctor_id"]) if relationships else None
    assigned_doctor_name = None
    if assigned_doctor_id:
        doctor = db.get_user_profile(assigned_doctor_id)
        assigned_doctor_name = doctor.get("full_name") if doctor else None

    sessions = db.list_sessions(patient_id=patient_id)
    sessions.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)

    assigned_radiologist_id = next(
        (str(s["radiologist_id"]) for s in sessions if s.get("radiologist_id")), None
    )
    assigned_radiologist_name = None
    if assigned_radiologist_id:
        radiologist = db.get_user_profile(assigned_radiologist_id)
        assigned_radiologist_name = radiologist.get("full_name") if radiologist else None

    return PatientProfileDetail(
        id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        phone=user["phone"],
        avatar_url=user.get("avatar_url"),
        account_status=user["account_status"],
        created_at=user.get("created_at"),
        hospital_id=hospital_id,
        hospital_name=hospital["name"] if hospital else None,
        patient_code=profile.get("patient_id"),
        date_of_birth=profile.get("date_of_birth"),
        blood_type=_blood_type(db, profile.get("blood_group_id")),
        emergency_contact_name=profile.get("emergency_contact_name"),
        emergency_contact_phone=profile.get("emergency_contact_phone"),
        verification_status=profile.get("verification_status"),
        assigned_doctor_id=assigned_doctor_id,
        assigned_doctor_name=assigned_doctor_name,
        assigned_radiologist_id=assigned_radiologist_id,
        assigned_radiologist_name=assigned_radiologist_name,
        mri_sessions=[_to_session_status(s) for s in sessions if s.get("modality") == "mri"],
        eeg_sessions=[_to_session_status(s) for s in sessions if s.get("modality") == "eeg"],
        reports_count=sum(1 for s in sessions if s.get("status") == "completed"),
    )


@router.get("/hospital-admins/{admin_id}", response_model=HospitalAdminProfileDetail)
def get_hospital_admin_detail(
    admin_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> HospitalAdminProfileDetail:
    user = require_user(db, admin_id)
    if user.get("role") != Role.hospital_admin.value:
        raise _not_found("Hospital admin")

    hospital_id = user.get("hospital_id")
    hospital = db.get_hospital(hospital_id) if hospital_id else None

    doctor_count = len(
        db.list_user_profiles(hospital_id=hospital_id, role=Role.doctor.value, exclude_deleted=True)
    ) if hospital_id else 0
    radiologist_count = len(
        db.list_user_profiles(hospital_id=hospital_id, role=Role.radiologist.value, exclude_deleted=True)
    ) if hospital_id else 0
    patient_count = len(
        db.list_user_profiles(hospital_id=hospital_id, role=Role.patient.value, exclude_deleted=True)
    ) if hospital_id else 0

    sessions = db.list_sessions(hospital_id=hospital_id) if hospital_id else []
    sessions.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)

    return HospitalAdminProfileDetail(
        id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        phone=user["phone"],
        avatar_url=user.get("avatar_url"),
        account_status=user["account_status"],
        created_at=user.get("created_at"),
        hospital_id=hospital_id,
        hospital_name=hospital["name"] if hospital else None,
        hospital_code=hospital["hospital_code"] if hospital else None,
        hospital_address=hospital["address"] if hospital else None,
        hospital_status=hospital["status"] if hospital else None,
        doctor_count=doctor_count,
        radiologist_count=radiologist_count,
        patient_count=patient_count,
        mri_count=sum(1 for s in sessions if s.get("modality") == "mri"),
        eeg_count=sum(1 for s in sessions if s.get("modality") == "eeg"),
        reports_generated=sum(1 for s in sessions if s.get("status") == "completed"),
        pending_reports=sum(1 for s in sessions if s.get("status") in ("queued", "processing")),
        recent_sessions=[_to_session_status(s) for s in sessions[:10]],
        patient_names=_patient_name_map(db, sessions[:10]),
    )
