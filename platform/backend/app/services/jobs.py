"""JobService interface (doc 4.2 / Decision 2).

The API only ever calls ``job_service.enqueue_analysis(session_id)``. The MVP
implementation runs jobs on a ``ThreadPoolExecutor``; production can later swap in
Celery/RQ/cloud workers by providing another implementation of this interface —
without changing any API route.
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class JobService(ABC):
    @abstractmethod
    def enqueue_analysis(self, session_id: str) -> None:
        """Schedule background processing for a session."""

    def shutdown(self) -> None:  # optional lifecycle hook
        """Release resources (called on app shutdown)."""


# Process-wide singleton, set at app startup via set_job_service().
_job_service: JobService | None = None


def set_job_service(service: JobService) -> None:
    global _job_service
    _job_service = service


def get_job_service() -> JobService:
    if _job_service is None:
        raise RuntimeError("JobService not initialized. Call set_job_service() at startup.")
    return _job_service
