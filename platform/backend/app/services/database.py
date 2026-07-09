"""Database service — the single adapter over Supabase tables.

Consolidates the divergent ``database.py`` helpers of the two old backends
(EEG ``predictions`` vs MRI ``mri_sessions``/``mri_predictions``) into one API
over the **unified** tables (``analysis_sessions`` / ``analysis_results`` /
``analysis_reports`` / ``job_events``). Standardizes on the supabase-py v2 query
builder.

The client is injected (``DatabaseService(client=...)``) so tests pass a fake and
no secrets are needed. When no client is given it lazily uses the configured
service-role client.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.logging import get_logger
from app.pipelines.base import PipelineResult
from app.schemas.analysis import SessionStatus
from app.services.supabase_client import get_service_client, require_client

logger = get_logger(__name__)

SESSIONS_TABLE = "analysis_sessions"
RESULTS_TABLE = "analysis_results"
REPORTS_TABLE = "analysis_reports"
EVENTS_TABLE = "job_events"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _one(execute_result: Any) -> dict | None:
    """Extract a single row from a supabase execute() result."""
    data = getattr(execute_result, "data", None)
    if data is None:
        return None
    if isinstance(data, list):
        return data[0] if data else None
    return data


class DatabaseService:
    def __init__(self, client: Any | None = None) -> None:
        self._client = client if client is not None else get_service_client()

    @property
    def client(self) -> Any:
        return require_client(self._client)

    # ----------------------------- sessions ----------------------------- #

    def create_session(
        self,
        *,
        modality: str,
        analysis_type: str,
        original_filename: str,
        patient_id: str,
        doctor_id: str | None = None,
        radiologist_id: str | None = None,
        technician_id: str | None = None,
        hospital_id: str | None = None,
        uploaded_by: str | None = None,
        uploaded_by_role: str | None = None,
        pipeline_options: dict | None = None,
    ) -> dict:
        """Insert a queued analysis_sessions row and return it."""
        row = {
            "modality": modality,
            "analysis_type": analysis_type,
            "original_filename": original_filename,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "radiologist_id": radiologist_id,
            "technician_id": technician_id,
            "hospital_id": hospital_id,
            "uploaded_by": uploaded_by,
            "uploaded_by_role": uploaded_by_role,
            "status": SessionStatus.queued.value,
            "progress_percent": 0,
            "pipeline_options": pipeline_options or {},
        }
        res = self.client.table(SESSIONS_TABLE).insert(row).execute()
        created = _one(res)
        if not created:
            raise RuntimeError("Failed to create analysis session (empty insert result).")
        return created

    def get_session(self, session_id: str) -> dict | None:
        res = (
            self.client.table(SESSIONS_TABLE)
            .select("*")
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )
        return _one(res)

    def set_raw_file(self, session_id: str, *, path: str, bucket: str) -> None:
        self._update_session(session_id, {"raw_file_path": path, "raw_file_bucket": bucket})

    def update_session_stage(
        self,
        session_id: str,
        *,
        status: str | None = None,
        stage: str | None = None,
        progress: int | None = None,
    ) -> None:
        patch: dict[str, Any] = {"updated_at": _now()}
        if status is not None:
            patch["status"] = status
            if status == SessionStatus.processing.value:
                patch.setdefault("started_at", _now())
        if stage is not None:
            patch["current_stage"] = stage
        if progress is not None:
            patch["progress_percent"] = max(0, min(100, progress))
        self._update_session(session_id, patch)

    def mark_completed(self, session_id: str) -> None:
        self._update_session(
            session_id,
            {
                "status": SessionStatus.completed.value,
                "progress_percent": 100,
                "current_stage": "cleanup",
                "completed_at": _now(),
                "updated_at": _now(),
            },
        )

    def mark_failed(self, session_id: str, error_message: str) -> None:
        self._update_session(
            session_id,
            {
                "status": SessionStatus.failed.value,
                "error_message": error_message[:2000],
                "updated_at": _now(),
            },
        )

    def increment_retry(self, session_id: str) -> int:
        session = self.get_session(session_id) or {}
        new_count = int(session.get("retry_count", 0)) + 1
        self._update_session(
            session_id,
            {
                "retry_count": new_count,
                "status": SessionStatus.queued.value,
                "error_message": None,
                "progress_percent": 0,
                "current_stage": None,
                "updated_at": _now(),
            },
        )
        return new_count

    def _update_session(self, session_id: str, patch: dict) -> None:
        self.client.table(SESSIONS_TABLE).update(patch).eq("id", session_id).execute()

    # ----------------------------- results ------------------------------ #

    def insert_result(
        self, session_id: str, result: PipelineResult, *, visualizations: dict | None = None
    ) -> dict:
        """Persist a normalized PipelineResult into analysis_results."""
        row = {
            "session_id": session_id,
            "prediction": result.prediction,
            "confidence": result.confidence,
            "probabilities": result.probabilities,
            "metrics": result.metrics,
            "similarity": result.similarity,
            "consistency": result.consistency,
            "visualizations": visualizations
            if visualizations is not None
            else result.visualizations,
            "model_version": result.model_version,
        }
        res = self.client.table(RESULTS_TABLE).insert(row).execute()
        return _one(res) or {}

    def get_result(self, session_id: str) -> dict | None:
        res = (
            self.client.table(RESULTS_TABLE)
            .select("*")
            .eq("session_id", session_id)
            .maybe_single()
            .execute()
        )
        return _one(res)

    # ----------------------------- reports ------------------------------ #

    def insert_reports(
        self,
        session_id: str,
        *,
        patient_pdf_url: str | None = None,
        clinician_pdf_url: str | None = None,
        technical_pdf_url: str | None = None,
        asset_urls: dict | None = None,
    ) -> dict:
        row = {
            "session_id": session_id,
            "patient_pdf_url": patient_pdf_url,
            "clinician_pdf_url": clinician_pdf_url,
            "technical_pdf_url": technical_pdf_url,
            "asset_urls": asset_urls or {},
        }
        res = self.client.table(REPORTS_TABLE).insert(row).execute()
        return _one(res) or {}

    def get_reports(self, session_id: str) -> dict | None:
        res = (
            self.client.table(REPORTS_TABLE)
            .select("*")
            .eq("session_id", session_id)
            .maybe_single()
            .execute()
        )
        return _one(res)

    # ---------------------------- job events ---------------------------- #

    def insert_job_event(
        self,
        session_id: str,
        *,
        message: str,
        level: str = "info",
        stage: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        try:
            self.client.table(EVENTS_TABLE).insert(
                {
                    "session_id": session_id,
                    "level": level,
                    "stage": stage,
                    "message": message,
                    "metadata": metadata or {},
                }
            ).execute()
        except Exception as exc:  # job events are best-effort, never fatal
            logger.warning("Failed to write job_event for %s: %s", session_id, exc)
