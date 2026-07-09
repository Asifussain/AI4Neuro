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
    UploadFile,
    status,
)

from app.api.deps import get_database, get_storage
from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.core.security import Principal, get_current_principal
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


@router.post("", response_model=CreateAnalysisResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_analysis(
    file: UploadFile = File(...),
    modality: str = Form(...),
    analysis_type: str = Form(...),
    patient_id: str = Form(...),
    doctor_id: str | None = Form(default=None),
    hospital_id: str | None = Form(default=None),
    radiologist_id: str | None = Form(default=None),
    technician_id: str | None = Form(default=None),
    uploaded_by_role: str | None = Form(default=None),
    channel_index: int | None = Form(default=None),        # EEG: similarity-plot channel
    scan_metadata_json: str | None = Form(default=None),   # MRI: scanner/sequence metadata
    principal: Principal = Depends(get_current_principal),
    db: DatabaseService = Depends(get_database),
    storage: StorageService = Depends(get_storage),
    settings: Settings = Depends(get_settings),
) -> CreateAnalysisResponse:
    modality = modality.lower().strip()
    _validate_upload(modality, file.filename or "")

    data = await file.read()
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "file_too_large",
                "message": f"File exceeds {settings.max_upload_mb} MB limit.",
            },
        )

    pipeline_options = _build_pipeline_options(modality, channel_index, scan_metadata_json)

    # 1) Create the session row (queued).
    session = db.create_session(
        modality=modality,
        analysis_type=analysis_type,
        original_filename=file.filename or "upload",
        patient_id=patient_id,
        doctor_id=doctor_id,
        radiologist_id=radiologist_id,
        technician_id=technician_id,
        hospital_id=hospital_id,
        uploaded_by=None if principal.is_dev else principal.user_id,
        uploaded_by_role=uploaded_by_role,
        pipeline_options=pipeline_options,
    )
    session_id = str(session["id"])

    # 2) Upload the raw file and record its location.
    bucket, path = storage.upload_raw_file(
        modality=modality,
        session_id=session_id,
        filename=file.filename or "upload",
        data=data,
    )
    db.set_raw_file(session_id, path=path, bucket=bucket)
    db.insert_job_event(session_id, message="Upload stored", stage="saved_upload")

    # 3) Enqueue background processing (behind the JobService boundary).
    get_job_service().enqueue_analysis(session_id)

    return CreateAnalysisResponse(
        session_id=session_id,
        status=SessionStatus.queued.value,
        modality=modality,
        analysis_type=analysis_type,
    )


@router.get("/{session_id}", response_model=SessionStatusResponse)
def get_status(
    session_id: str,
    principal: Principal = Depends(get_current_principal),
    db: DatabaseService = Depends(get_database),
) -> SessionStatusResponse:
    session = _require_session(db, session_id)
    return SessionStatusResponse(
        id=str(session["id"]),
        modality=session["modality"],
        analysis_type=session["analysis_type"],
        status=session["status"],
        current_stage=session.get("current_stage"),
        progress_percent=session.get("progress_percent", 0) or 0,
        error_message=session.get("error_message"),
        created_at=session.get("created_at"),
        updated_at=session.get("updated_at"),
    )


@router.get("/{session_id}/result", response_model=AnalysisResultResponse)
def get_result(
    session_id: str,
    principal: Principal = Depends(get_current_principal),
    db: DatabaseService = Depends(get_database),
) -> AnalysisResultResponse:
    session = _require_session(db, session_id)
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
        report_urls=_report_urls(reports),
    )


@router.get("/{session_id}/reports", response_model=ReportsResponse)
def get_reports(
    session_id: str,
    principal: Principal = Depends(get_current_principal),
    db: DatabaseService = Depends(get_database),
) -> ReportsResponse:
    _require_session(db, session_id)
    reports = db.get_reports(session_id) or {}
    return ReportsResponse(
        session_id=session_id,
        report_urls=_report_urls(reports),
        asset_urls=reports.get("asset_urls") or {},
    )


@router.post("/{session_id}/retry", response_model=RetryResponse)
def retry_analysis(
    session_id: str,
    principal: Principal = Depends(get_current_principal),
    db: DatabaseService = Depends(get_database),
) -> RetryResponse:
    session = _require_session(db, session_id)
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
    modality: str, channel_index: int | None, scan_metadata_json: str | None
) -> dict:
    """Assemble the modality-specific options bag persisted on the session."""
    options: dict = {}
    if modality == Modality.eeg.value and channel_index is not None:
        options["channel_index"] = channel_index
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


def _require_session(db: DatabaseService, session_id: str) -> dict:
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "session_not_found", "message": "Analysis session not found."},
        )
    return session


def _report_urls(reports: dict) -> ReportUrls:
    return ReportUrls(
        patient=reports.get("patient_pdf_url"),
        clinician=reports.get("clinician_pdf_url"),
        technical=reports.get("technical_pdf_url"),
    )
