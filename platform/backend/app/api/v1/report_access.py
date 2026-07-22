"""Patient -> assigned-doctor report-access request/approve flow.

A patient must request access to their own analysis reports; the report only
opens once their assigned doctor (or a hospital_admin / super_admin) approves.
One record per patient tracks the current state (none/pending/approved/denied).

Enforcement of the grant itself lives in ``analysis.get_reports`` (a patient
caller is 403'd until their record is ``approved``); this module manages the
request lifecycle and the doctor's pending queue.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user, get_database
from app.api.v1._common import forbid
from app.core.security import Principal
from app.schemas.common import PaginatedResponse
from app.schemas.users import ReportAccessRequestResponse
from app.services.database import DatabaseService

router = APIRouter(prefix="/hospital/report-access", tags=["report-access"])


def _assigned_doctor_id(db: DatabaseService, patient_id: str, hospital_id: str | None) -> str | None:
    rels = [
        r
        for r in db.list_doctor_patient_relationships(hospital_id=hospital_id, patient_id=patient_id)
        if r.get("relationship_status") == "active"
    ]
    rels.sort(key=lambda r: str(r.get("assigned_at") or ""), reverse=True)
    return str(rels[0]["doctor_id"]) if rels else None


def _to_response(db: DatabaseService, row: dict) -> ReportAccessRequestResponse:
    patient = db.get_user_profile(str(row["patient_id"])) if row.get("patient_id") else None
    doctor = db.get_user_profile(str(row["doctor_id"])) if row.get("doctor_id") else None
    return ReportAccessRequestResponse(
        id=str(row["id"]) if row.get("id") else None,
        patient_id=str(row["patient_id"]),
        patient_name=patient.get("full_name") if patient else None,
        doctor_id=str(row["doctor_id"]) if row.get("doctor_id") else None,
        doctor_name=doctor.get("full_name") if doctor else None,
        hospital_id=str(row["hospital_id"]) if row.get("hospital_id") else None,
        status=row.get("status", "none"),
        created_at=row.get("created_at"),
        decided_at=row.get("decided_at"),
    )


@router.post("/request", response_model=ReportAccessRequestResponse, status_code=status.HTTP_201_CREATED)
def request_access(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> ReportAccessRequestResponse:
    """A patient requests report access from their assigned doctor."""
    if principal.role != "patient":
        raise forbid("Only patients may request report access.")

    doctor_id = _assigned_doctor_id(db, principal.user_id, principal.hospital_id)
    if not doctor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "no_assigned_doctor",
                "message": "You have no assigned doctor yet. Ask your hospital to assign one.",
            },
        )

    existing = db.get_report_access_by_patient(principal.user_id)
    # Already approved -> keep it (re-requesting shouldn't revoke access).
    new_status = "approved" if existing and existing.get("status") == "approved" else "pending"
    row = db.upsert_report_access_request(
        patient_id=principal.user_id,
        doctor_id=doctor_id,
        hospital_id=principal.hospital_id,
        status=new_status,
    )
    return _to_response(db, row)


@router.get("/me", response_model=ReportAccessRequestResponse)
def my_access(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> ReportAccessRequestResponse:
    """The calling patient's current report-access state."""
    if principal.role != "patient":
        raise forbid("Only patients have a report-access record.")
    row = db.get_report_access_by_patient(principal.user_id)
    if not row:
        return ReportAccessRequestResponse(patient_id=principal.user_id, status="none")
    return _to_response(db, row)


@router.get("/pending", response_model=PaginatedResponse[ReportAccessRequestResponse])
def pending_requests(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[ReportAccessRequestResponse]:
    """Pending report-access requests a doctor (or hospital admin) must act on."""
    if principal.role == "doctor":
        rows = db.list_report_access_requests(doctor_id=principal.user_id, status="pending")
    elif principal.role in ("admin", "super_admin"):
        rows = db.list_report_access_requests(
            hospital_id=None if principal.role == "super_admin" else principal.hospital_id,
            status="pending",
        )
    else:
        raise forbid("You do not have a report-access approval queue.")
    rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
    items = [_to_response(db, r) for r in rows[offset : offset + limit]]
    return PaginatedResponse(items=items, total=len(rows), limit=limit, offset=offset)


def _decide(request_id: str, new_status: str, principal: Principal, db: DatabaseService) -> ReportAccessRequestResponse:
    row = db.get_report_access(request_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "request_not_found", "message": "Report-access request not found."},
        )
    # The assigned doctor, a same-hospital admin, or a super_admin may decide.
    allowed = (
        (principal.role == "doctor" and str(row.get("doctor_id")) == str(principal.user_id))
        or principal.role == "super_admin"
        or (principal.role == "admin" and str(row.get("hospital_id")) == str(principal.hospital_id))
    )
    if not allowed:
        raise forbid("You may not decide this report-access request.")
    updated = db.set_report_access_status(request_id, new_status)
    return _to_response(db, updated or {**row, "status": new_status})


@router.post("/{request_id}/approve", response_model=ReportAccessRequestResponse)
def approve_access(
    request_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> ReportAccessRequestResponse:
    return _decide(request_id, "approved", principal, db)


@router.post("/{request_id}/deny", response_model=ReportAccessRequestResponse)
def deny_access(
    request_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> ReportAccessRequestResponse:
    return _decide(request_id, "denied", principal, db)
