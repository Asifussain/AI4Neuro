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

    def delete_session(self, session_id: str) -> None:
        """Delete an analysis_sessions row and related results/reports/events."""
        self.client.table(RESULTS_TABLE).delete().eq("session_id", session_id).execute()
        self.client.table(REPORTS_TABLE).delete().eq("session_id", session_id).execute()
        self.client.table(EVENTS_TABLE).delete().eq("session_id", session_id).execute()
        self.client.table(SESSIONS_TABLE).delete().eq("id", session_id).execute()
        try:
            self.client.table("mri_predictions").delete().eq("session_id", session_id).execute()
            self.client.table("mri_sessions").delete().eq("id", session_id).execute()
        except Exception:
            pass

    def list_sessions(
        self,
        *,
        modality: str | None = None,
        status: str | None = None,
        patient_id: str | None = None,
        hospital_id: str | None = None,
    ) -> list[dict]:
        """Fetch sessions matching the provided equality filters.

        Role-scoping / ordering / limit are applied by the caller (route) so the
        same code path works against Supabase and the in-memory test fake.
        """
        query = self.client.table(SESSIONS_TABLE).select("*")
        if modality:
            query = query.eq("modality", modality)
        if status:
            query = query.eq("status", status)
        if patient_id:
            query = query.eq("patient_id", patient_id)
        if hospital_id:
            query = query.eq("hospital_id", hospital_id)
        res = query.execute()
        data = getattr(res, "data", None) or []
        return list(data)

    # ----------------------------- profiles ----------------------------- #

    def get_user_profile(self, user_id: str) -> dict | None:
        """Fetch a user_profiles row (role/account_status/hospital_id/…)."""
        res = (
            self.client.table("user_profiles")
            .select("*")
            .eq("id", user_id)
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

    # ---------------------------- hospitals ------------------------------ #

    def create_hospital(self, row: dict) -> dict:
        row = {"status": "active", **row}
        res = self.client.table("hospitals").insert(row).execute()
        created = _one(res)
        if not created:
            raise RuntimeError("Failed to create hospital (empty insert result).")
        return created

    def get_hospital(self, hospital_id: str) -> dict | None:
        res = (
            self.client.table("hospitals")
            .select("*")
            .eq("id", hospital_id)
            .maybe_single()
            .execute()
        )
        return _one(res)

    def list_hospitals(self) -> list[dict]:
        res = self.client.table("hospitals").select("*").execute()
        return list(getattr(res, "data", None) or [])

    def list_blood_groups(self) -> list[dict]:
        res = self.client.table("blood_groups").select("*").order("id").execute()
        return list(getattr(res, "data", None) or [])

    def update_hospital(self, hospital_id: str, patch: dict) -> dict | None:
        patch = {**patch, "updated_at": _now()}
        self.client.table("hospitals").update(patch).eq("id", hospital_id).execute()
        return self.get_hospital(hospital_id)

    def set_hospital_status(self, hospital_id: str, status_value: str) -> dict | None:
        return self.update_hospital(hospital_id, {"status": status_value})

    # ------------------------------ users --------------------------------- #

    def create_user_profile(self, row: dict) -> dict:
        res = self.client.table("user_profiles").insert(row).execute()
        created = _one(res)
        if not created:
            raise RuntimeError("Failed to create user profile (empty insert result).")
        return created

    def list_user_profiles(
        self,
        *,
        hospital_id: str | None = None,
        role: str | None = None,
        exclude_deleted: bool = False,
    ) -> list[dict]:
        """List user_profiles rows matching the given equality filters.

        ``exclude_deleted``: directory-style listings (GET /hospital/users,
        /doctors, /patients) pass True so terminally soft-deleted accounts
        (account_status="deleted") never show up; admin lookups by id
        (GET .../{id}) leave it False so a deleted user is still viewable/
        auditable, just hidden from browse listings.
        """
        query = self.client.table("user_profiles").select("*")
        if hospital_id:
            query = query.eq("hospital_id", hospital_id)
        if role:
            query = query.eq("role", role)
        res = query.execute()
        rows = list(getattr(res, "data", None) or [])
        if exclude_deleted:
            rows = [r for r in rows if r.get("account_status") != "deleted"]
        return rows

    def update_user_profile(self, user_id: str, patch: dict) -> dict | None:
        patch = {**patch, "updated_at": _now()}
        self.client.table("user_profiles").update(patch).eq("id", user_id).execute()
        return self.get_user_profile(user_id)

    def create_role_profile(self, table: str, row: dict) -> dict:
        res = self.client.table(table).insert(row).execute()
        return _one(res) or {}

    def list_role_profiles(self, table: str) -> list[dict]:
        """Fetch every row of a role-detail table (keyed by user_id).

        Small, per-hospital-scale tables — callers merge these in Python against
        a already-scoped user_profiles list rather than filtering server-side,
        matching the existing list_hospitals/list_user_profiles pattern.
        """
        res = self.client.table(table).select("*").execute()
        return list(getattr(res, "data", None) or [])

    def update_role_profile(self, table: str, user_id: str, patch: dict) -> dict | None:
        self.client.table(table).update(patch).eq("user_id", user_id).execute()

    def upsert_role_profile(self, table: str, user_id: str, patch: dict) -> dict:
        row = {"user_id": user_id, **patch, "updated_at": _now()}
        res = self.client.table(table).upsert(row, on_conflict="user_id").execute()
        return _one(res) or {}
        res = (
            self.client.table(table)
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return _one(res)

    def create_doctor_patient_relationship(self, row: dict) -> dict:
        res = self.client.table("doctor_patient_relationships").insert(row).execute()
        return _one(res) or {}

    def list_doctor_patient_relationships(self, *, hospital_id: str | None = None) -> list[dict]:
        query = self.client.table("doctor_patient_relationships").select("*")
        if hospital_id:
            query = query.eq("hospital_id", hospital_id)
        res = query.execute()
        return list(getattr(res, "data", None) or [])

    def get_doctor_patient_relationship(self, relationship_id: str) -> dict | None:
        res = (
            self.client.table("doctor_patient_relationships")
            .select("*")
            .eq("id", relationship_id)
            .maybe_single()
            .execute()
        )
        return _one(res)

    def delete_doctor_patient_relationship(self, relationship_id: str) -> None:
        self.client.table("doctor_patient_relationships").delete().eq(
            "id", relationship_id
        ).execute()

    # ---------------------------- audit log ------------------------------- #

    def insert_audit_log(
        self,
        *,
        actor_id: str | None,
        actor_role: str | None,
        hospital_id: str | None,
        action: str,
        target_table: str | None = None,
        target_id: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        try:
            self.client.table("audit_log").insert(
                {
                    "actor_id": actor_id,
                    "actor_role": actor_role,
                    "hospital_id": hospital_id,
                    "action": action,
                    "target_table": target_table,
                    "target_id": target_id,
                    "metadata": metadata or {},
                }
            ).execute()
        except Exception as exc:  # audit logging is best-effort, never fatal
            logger.warning("Failed to write audit_log entry for %s: %s", action, exc)

    def list_audit_log(self, *, hospital_id: str | None = None) -> list[dict]:
        """Most-recent-first, matching the existing fetch-then-filter DB pattern
        (see list_hospitals/list_user_profiles) — sorting/pagination happen in
        Python via app.api.v1._common.paginate() rather than at the query."""
        query = self.client.table("audit_log").select("*")
        if hospital_id:
            query = query.eq("hospital_id", hospital_id)
        res = query.execute()
        rows = list(getattr(res, "data", None) or [])
        rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
        return rows

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
