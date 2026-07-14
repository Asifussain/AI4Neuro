"""API request/response schemas for the unified analysis contract (doc 5).

These are the wire types the frontend depends on. They are deliberately separate
from the pipeline contracts in ``app/pipelines/base.py``: pipelines speak
``PipelineResult``; the API speaks these DTOs. The service layer maps between them.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Modality(str, Enum):
    eeg = "eeg"
    mri = "mri"


class SessionStatus(str, Enum):
    queued = "queued"
    uploading = "uploading"
    processing = "processing"
    preprocessing = "preprocessing"
    running_model = "running_model"
    generating_visualizations = "generating_visualizations"
    generating_reports = "generating_reports"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


# Statuses that mean the job is still in flight (frontend keeps polling).
ACTIVE_STATUSES: frozenset[str] = frozenset(
    {
        SessionStatus.queued.value,
        SessionStatus.uploading.value,
        SessionStatus.processing.value,
        SessionStatus.preprocessing.value,
        SessionStatus.running_model.value,
        SessionStatus.generating_visualizations.value,
        SessionStatus.generating_reports.value,
    }
)
TERMINAL_STATUSES: frozenset[str] = frozenset(
    {
        SessionStatus.completed.value,
        SessionStatus.failed.value,
        SessionStatus.cancelled.value,
    }
)

# Allowed upload extensions per modality (validated at the API boundary).
ALLOWED_EXTENSIONS: dict[str, tuple[str, ...]] = {
    Modality.eeg.value: (".npy",),
    Modality.mri.value: (".nii", ".nii.gz", ".gz"),
}


class CreateAnalysisResponse(BaseModel):
    """Returned by ``POST /api/v1/analysis`` (doc 5.2)."""

    session_id: str
    status: str = SessionStatus.queued.value
    modality: str
    analysis_type: str


class SessionStatusResponse(BaseModel):
    """Returned by ``GET /api/v1/analysis/{id}`` (doc 5.3)."""

    id: str
    modality: str
    analysis_type: str
    patient_id: str | None = None
    doctor_id: str | None = None
    status: str
    current_stage: str | None = None
    progress_percent: int = 0
    error_message: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_STATUSES


class ReportUrls(BaseModel):
    patient: str | None = None
    clinician: str | None = None
    technical: str | None = None


class AnalysisResultResponse(BaseModel):
    """Unified result shape returned by ``GET /api/v1/analysis/{id}/result``.

    Identical outer structure for EEG and MRI (doc 5.4); modality specifics live
    inside the jsonb sub-objects.
    """

    session_id: str
    modality: str
    analysis_type: str
    prediction: str
    confidence: float | None = None
    probabilities: dict[str, float] = Field(default_factory=dict)
    metrics: dict = Field(default_factory=dict)
    similarity: dict = Field(default_factory=dict)
    consistency: dict = Field(default_factory=dict)
    visualizations: dict = Field(default_factory=dict)
    model_version: str | None = None
    report_urls: ReportUrls = Field(default_factory=ReportUrls)


class ReportsResponse(BaseModel):
    """Returned by ``GET /api/v1/analysis/{id}/reports``."""

    session_id: str
    report_urls: ReportUrls = Field(default_factory=ReportUrls)
    asset_urls: dict = Field(default_factory=dict)


class RetryResponse(BaseModel):
    session_id: str
    status: str
    retry_count: int


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


UploadedByRole = Literal["super_admin", "hospital_admin", "doctor", "radiologist", "patient"]
