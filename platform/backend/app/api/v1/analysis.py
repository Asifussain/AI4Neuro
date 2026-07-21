"""Unified analysis API (doc 5).

One endpoint pair for both modalities. The frontend only chooses ``modality``;
the backend routes to the right pipeline internally. Result shapes are identical
across modalities.
"""

from __future__ import annotations

import json

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)

from app.api.deps import get_current_user, get_database, get_storage
from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.core.security import Principal
from app.services import permissions
from app.schemas.analysis import (
    ALLOWED_EXTENSIONS,
    AnalysisResultResponse,
    CancelResponse,
    CreateAnalysisResponse,
    Modality,
    ReportsResponse,
    ReportUrls,
    RetryResponse,
    SessionStatus,
    SessionStatusResponse,
)
from app.schemas.common import PaginatedResponse
from app.services.database import DatabaseService
from app.services.jobs import get_job_service
from app.services.storage import StorageService

logger = get_logger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _validate_upload(modality: str, filename: str) -> None:
    if modality not in {m.value for m in Modality}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_modality", "message": f"Unknown modality {modality!r}."},
        )
    allowed = ALLOWED_EXTENSIONS[modality]
    lower = (filename or "").lower()
    if not any(lower.endswith(ext) for ext in allowed):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "invalid_file_type",
                "message": f"{modality} accepts {', '.join(allowed)}; got {filename!r}.",
            },
        )


_UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1 MiB


async def _read_upload_within_limit(file: UploadFile, max_bytes: int, max_mb: int) -> bytes:
    """Read an upload in chunks, aborting as soon as the limit is crossed.

    Reading the whole body first and checking its length afterwards (the
    prior approach) means an oversized upload is fully buffered in memory
    before being rejected — the check runs too late to prevent the memory
    spike it's meant to guard against.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_UPLOAD_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={
                    "code": "file_too_large",
                    "message": f"File exceeds {max_mb} MB limit.",
                },
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _validate_role_assignment(
    db: DatabaseService, user_id: str | None, *, role: str, hospital_id: str | None, field: str
) -> None:
    """Confirm a client-supplied doctor_id/radiologist_id is real and in-scope.

    Without this, permissions.can_read_session grants read access to whoever
    is named doctor_id/radiologist_id on a session row, so an uploader could
    otherwise name an arbitrary user to grant them access to someone else's
    session.
    """
    if not user_id:
        return
    user = db.get_user_profile(user_id)
    if not user or user.get("role") != role or str(user.get("hospital_id")) != str(hospital_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": f"invalid_{field}",
                "message": f"{field} must be an active {role} in the target hospital.",
            },
        )


def _normalize_analysis_type(modality: str, analysis_type: str) -> str:
    value = (analysis_type or "").strip().lower()
    if modality == Modality.mri.value:
        # MRI is multiclass-only: the ConViT checkpoint is trained multiclass-only,
        # so there is no binary MRI path regardless of what the client requests.
        return "multiclass"
    if modality == Modality.eeg.value:
        # EEG is ADFD-only: the ADSZ (binary) checkpoint is retired server-side.
        # Force multiclass regardless of client input so pre-update frontend
        # clients that still send "binary" keep working, mirroring the MRI
        # override above.
        return "multiclass"
    allowed = {"binary", "multiclass"}
    if value not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "invalid_analysis_type",
                "message": "Analysis type must be Binary or Multiclass.",
            },
        )
    return value


def _safe_exception_details(exc: Exception) -> dict:
    """Expose concise DB/storage diagnostics without leaking stack traces."""
    details = {
        "type": exc.__class__.__name__,
        "message": str(exc)[:500],
    }
    for attr in ("code", "message", "details", "hint"):
        value = getattr(exc, attr, None)
        if value:
            details[attr] = str(value)[:500]
    return details


@router.post("", response_model=CreateAnalysisResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_analysis(
    file: UploadFile = File(...),
    modality: str = Form(...),
    analysis_type: str = Form(...),
    patient_id: str = Form(...),
    doctor_id: str | None = Form(default=None),
    hospital_id: str | None = Form(default=None),
    radiologist_id: str | None = Form(default=None),
    uploaded_by_role: str | None = Form(default=None),
    channel_index: int | None = Form(default=None),        # EEG: similarity-plot channel
    scan_metadata_json: str | None = Form(default=None),   # MRI: scanner/sequence metadata
    eeg_metadata_json: str | None = Form(default=None),    # EEG: channel names + sampling rate
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
    storage: StorageService = Depends(get_storage),
    settings: Settings = Depends(get_settings),
) -> CreateAnalysisResponse:
    modality = modality.lower().strip()
    _validate_upload(modality, file.filename or "")
    analysis_type = _normalize_analysis_type(modality, analysis_type)

    if not permissions.can_create_analysis(principal.role, modality):
        raise _forbid(f"Your role may not create {modality} analyses.")

    data = await _read_upload_within_limit(file, settings.max_upload_bytes, settings.max_upload_mb)

    pipeline_options = _build_pipeline_options(
        modality, channel_index, scan_metadata_json, eeg_metadata_json
    )
    uploaded_by_role = uploaded_by_role or principal.role

    # Authorization gap fix: reads are strictly hospital-scoped
    # (permissions.can_read_session), but this write previously accepted a
    # client-supplied hospital_id with no verification it matched the
    # caller's own hospital. Only super_admin may create analyses for a
    # hospital other than their own.
    if principal.role != "super_admin":
        if hospital_id and str(hospital_id) != str(principal.hospital_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "hospital_mismatch",
                    "message": "hospital_id must match your own hospital.",
                },
            )
        hospital_id = principal.hospital_id
    else:
        hospital_id = hospital_id or principal.hospital_id

    # Track whether these came from the client before self-assign defaulting
    # kicks in: a self-assigned id is just the caller's own already-verified
    # identity (principal.user_id/.role/.hospital_id, freshly loaded from
    # user_profiles by get_current_user) — re-validating it against the DB
    # would be redundant. Only a client-*supplied* id is the actual gap: it
    # names someone else, and can_read_session trusts whoever is named here.
    doctor_id_client_supplied = bool(doctor_id)
    radiologist_id_client_supplied = bool(radiologist_id)

    if principal.role == "radiologist" and not radiologist_id:
        radiologist_id = principal.user_id
    if principal.role == "doctor" and not doctor_id:
        doctor_id = principal.user_id

    if doctor_id_client_supplied:
        _validate_role_assignment(db, doctor_id, role="doctor", hospital_id=hospital_id, field="doctor_id")
    if radiologist_id_client_supplied:
        _validate_role_assignment(
            db, radiologist_id, role="radiologist", hospital_id=hospital_id, field="radiologist_id"
        )

    # 1) Create the session row (queued).
    try:
        session = db.create_session(
            modality=modality,
            analysis_type=analysis_type,
            original_filename=file.filename or "upload",
            patient_id=patient_id,
            doctor_id=doctor_id,
            radiologist_id=radiologist_id,
            hospital_id=hospital_id,
            uploaded_by=None if principal.is_dev else principal.user_id,
            uploaded_by_role=uploaded_by_role,
            pipeline_options=pipeline_options,
        )
    except Exception as exc:
        logger.exception("Failed to create analysis session.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "analysis_session_create_failed",
                "message": (
                    "Could not create the analysis session. Verify the selected patient, "
                    "doctor, hospital, and unified Supabase schema."
                ),
                "details": _safe_exception_details(exc),
            },
        ) from exc
    session_id = str(session["id"])

    # 2) Upload the raw file and record its location.
    try:
        bucket, path = storage.upload_raw_file(
            modality=modality,
            session_id=session_id,
            filename=file.filename or "upload",
            data=data,
        )
        db.set_raw_file(session_id, path=path, bucket=bucket)
        db.insert_job_event(session_id, message="Upload stored", stage="saved_upload")
    except Exception as exc:
        logger.exception("Failed to store raw upload for session %s.", session_id)
        db.mark_failed(session_id, f"Upload storage failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "raw_upload_failed",
                "message": "Could not store the uploaded file. Verify Supabase storage buckets.",
                "details": _safe_exception_details(exc),
            },
        ) from exc

    # 3) Enqueue background processing (behind the JobService boundary).
    try:
        get_job_service().enqueue_analysis(session_id)
    except Exception as exc:
        logger.exception("Failed to enqueue analysis job for session %s.", session_id)
        db.mark_failed(session_id, f"Job enqueue failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "job_enqueue_failed",
                "message": "Analysis session was created, but processing could not be started.",
                "details": _safe_exception_details(exc),
            },
        ) from exc

    return CreateAnalysisResponse(
        session_id=session_id,
        status=SessionStatus.queued.value,
        modality=modality,
        analysis_type=analysis_type,
    )


@router.get("", response_model=PaginatedResponse[SessionStatusResponse])
def list_analyses(
    modality: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    patient_id: str | None = Query(default=None),
    doctor_id: str | None = Query(default=None),
    radiologist_id: str | None = Query(default=None),
    hospital_id: str | None = Query(default=None),
    mine: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PaginatedResponse[SessionStatusResponse]:
    """Role-scoped list of analysis sessions the caller may see (doc 8.5).

    super_admin sees across all hospitals by default, or may narrow to one
    hospital via ``hospital_id``; every other role is pinned to their own
    hospital regardless of what (if anything) they pass. Every row is then
    checked with the same per-session permission used for reads.
    """
    hospital = hospital_id if principal.role == "super_admin" else principal.hospital_id
    rows = db.list_sessions(
        modality=modality,
        status=status_filter,
        patient_id=patient_id,
        doctor_id=doctor_id,
        radiologist_id=radiologist_id,
        hospital_id=hospital,
    )
    visible = [
        r
        for r in rows
        if permissions.can_read_session(
            principal.user_id, principal.role, principal.hospital_id, r
        )
    ]
    if mine:
        visible = [r for r in visible if str(r.get("uploaded_by")) == str(principal.user_id)]
    visible.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
    total = len(visible)
    page = visible[offset : offset + limit]
    return PaginatedResponse(
        items=[_to_status(r) for r in page], total=total, limit=limit, offset=offset
    )


@router.get("/{session_id}", response_model=SessionStatusResponse)
def get_status(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> SessionStatusResponse:
    session = _require_session(db, session_id)
    _require_read(principal, session)
    return _to_status(session)


@router.get("/{session_id}/result", response_model=AnalysisResultResponse)
def get_result(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
    storage: StorageService = Depends(get_storage),
) -> AnalysisResultResponse:
    session = _require_session(db, session_id)
    _require_read(principal, session)
    result = db.get_result(session_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "result_not_ready", "message": "Result not available yet."},
        )
    reports = db.get_reports(session_id) or {}
    return AnalysisResultResponse(
        session_id=session_id,
        modality=session["modality"],
        analysis_type=session["analysis_type"],
        prediction=result["prediction"],
        confidence=result.get("confidence"),
        probabilities=result.get("probabilities") or {},
        metrics=result.get("metrics") or {},
        similarity=result.get("similarity") or {},
        consistency=result.get("consistency") or {},
        visualizations=result.get("visualizations") or {},
        model_version=result.get("model_version"),
        report_urls=_report_urls(reports, storage),
    )


@router.get("/{session_id}/reports", response_model=ReportsResponse)
def get_reports(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
    storage: StorageService = Depends(get_storage),
) -> ReportsResponse:
    session = _require_session(db, session_id)
    if not permissions.can_read_report(
        principal.user_id, principal.role, principal.hospital_id, session
    ):
        raise _forbid("You do not have access to these reports.")
    reports = db.get_reports(session_id) or {}
    return ReportsResponse(
        session_id=session_id,
        report_urls=_report_urls(reports, storage),
        asset_urls=reports.get("asset_urls") or {},
    )


@router.post("/{session_id}/retry", response_model=RetryResponse)
def retry_analysis(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> RetryResponse:
    session = _require_session(db, session_id)
    if not permissions.can_retry_session(
        principal.user_id, principal.role, principal.hospital_id, session
    ):
        raise _forbid("You may not retry this analysis.")
    if session["status"] not in {SessionStatus.failed.value, SessionStatus.cancelled.value}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "retry_not_allowed",
                "message": f"Cannot retry a session in status {session['status']!r}.",
            },
        )
    retry_count = db.increment_retry(session_id)
    get_job_service().enqueue_analysis(session_id)
    return RetryResponse(
        session_id=session_id, status=SessionStatus.queued.value, retry_count=retry_count
    )


@router.post("/{session_id}/cancel", response_model=CancelResponse)
def cancel_analysis(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> CancelResponse:
    """Cancel an in-flight analysis. Same permission as retry (care team /
    admins, not the patient). Only valid from queued/processing — a session
    already terminal (completed/failed/cancelled) 409s, matching retry's
    status-guard pattern."""
    session = _require_session(db, session_id)
    if not permissions.can_retry_session(
        principal.user_id, principal.role, principal.hospital_id, session
    ):
        raise _forbid("You may not cancel this analysis.")
    if session["status"] not in {SessionStatus.queued.value, SessionStatus.processing.value}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "cancel_not_allowed",
                "message": f"Cannot cancel a session in status {session['status']!r}.",
            },
        )
    db.update_session_stage(session_id, status=SessionStatus.cancelled.value)
    db.insert_audit_log(
        actor_id=principal.user_id,
        actor_role=principal.role,
        hospital_id=session.get("hospital_id"),
        action="analysis.cancel",
        target_table="analysis_sessions",
        target_id=session_id,
    )
    return CancelResponse(session_id=session_id, status=SessionStatus.cancelled.value)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_analysis(
    session_id: str,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> None:
    """Delete an analysis session (Care team & admins)."""
    session = _require_session(db, session_id)
    if not permissions.can_retry_session(
        principal.user_id, principal.role, principal.hospital_id, session
    ):
        raise _forbid("You may not delete this analysis session.")
    db.delete_session(session_id)


def _build_pipeline_options(
    modality: str,
    channel_index: int | None,
    scan_metadata_json: str | None,
    eeg_metadata_json: str | None,
) -> dict:
    """Assemble the modality-specific options bag persisted on the session."""
    options: dict = {}
    if modality == Modality.eeg.value and channel_index is not None:
        options["channel_index"] = channel_index
    if modality == Modality.eeg.value and eeg_metadata_json:
        try:
            options["eeg_metadata"] = json.loads(eeg_metadata_json)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "invalid_eeg_metadata",
                    "message": "eeg_metadata_json must be valid JSON.",
                },
            )
    if modality == Modality.mri.value and scan_metadata_json:
        try:
            options["scan_metadata"] = json.loads(scan_metadata_json)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "invalid_scan_metadata",
                    "message": "scan_metadata_json must be valid JSON.",
                },
            )
    return options


def _to_status(session: dict) -> SessionStatusResponse:
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


def _require_session(db: DatabaseService, session_id: str) -> dict:
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "session_not_found", "message": "Analysis session not found."},
        )
    return session


def _require_read(principal: Principal, session: dict) -> None:
    if not permissions.can_read_session(
        principal.user_id, principal.role, principal.hospital_id, session
    ):
        raise _forbid("You do not have access to this analysis session.")


def _forbid(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "permission_denied", "message": message},
    )


def _report_urls(reports: dict, storage: StorageService) -> ReportUrls:
    # Report PDFs are generated once and their signed URL stored as-is; the
    # embedded JWT expires ~1h after generation (see StorageService.
    # refresh_signed_url). Re-sign on every read so a report viewed long
    # after it was generated doesn't fail with an expired-token error.
    return ReportUrls(
        patient=storage.refresh_signed_url(reports.get("patient_pdf_url")),
        clinician=storage.refresh_signed_url(reports.get("clinician_pdf_url")),
        technical=storage.refresh_signed_url(reports.get("technical_pdf_url")),
    )
