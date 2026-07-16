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
    CreateAnalysisResponse,
    Modality,
    ReportsResponse,
    ReportUrls,
    RetryResponse,
    SessionStatus,
    SessionStatusResponse,
)
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

    data = await file.read()
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "file_too_large",
                "message": f"File exceeds {settings.max_upload_mb} MB limit.",
            },
        )

    pipeline_options = _build_pipeline_options(
        modality, channel_index, scan_metadata_json, eeg_metadata_json
    )
    uploaded_by_role = uploaded_by_role or principal.role
    hospital_id = hospital_id or principal.hospital_id
    if principal.role == "radiologist" and not radiologist_id:
        radiologist_id = principal.user_id
    if principal.role == "doctor" and not doctor_id:
        doctor_id = principal.user_id

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


@router.get("", response_model=list[SessionStatusResponse])
def list_analyses(
    modality: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    patient_id: str | None = Query(default=None),
    mine: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> list[SessionStatusResponse]:
    """Role-scoped list of analysis sessions the caller may see (doc 8.5).

    super_admin sees across all hospitals; every other role is pre-filtered to
    their own hospital, then each row is checked with the same per-session
    permission used for reads.
    """
    hospital = None if principal.role == "super_admin" else principal.hospital_id
    rows = db.list_sessions(
        modality=modality,
        status=status_filter,
        patient_id=patient_id,
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
    return [_to_status(r) for r in visible[:limit]]


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
