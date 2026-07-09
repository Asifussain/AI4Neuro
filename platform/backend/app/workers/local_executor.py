"""Local JobService implementation using a ThreadPoolExecutor (doc 4.2).

Conservative worker count keeps long MRI jobs from starving the process. The EEG
pipeline (Phase 2) is made thread-safe by passing ``cwd=`` to its subprocess
instead of ``os.chdir`` — so >1 worker is safe.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Callable

from app.core.logging import get_logger
from app.services.jobs import JobService

logger = get_logger(__name__)


class LocalJobService(JobService):
    def __init__(
        self,
        *,
        max_workers: int = 2,
        runner: Callable[[str], None] | None = None,
    ) -> None:
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers, thread_name_prefix="analysis-job"
        )
        # Late import by default to avoid import cycles; override in tests.
        self._runner = runner

    def _resolve_runner(self) -> Callable[[str], None]:
        if self._runner is not None:
            return self._runner
        from app.services.orchestrator import run_analysis_job

        return run_analysis_job

    def enqueue_analysis(self, session_id: str) -> None:
        runner = self._resolve_runner()
        logger.info("Enqueuing analysis job for session %s", session_id)
        self._executor.submit(self._safe_run, runner, session_id)

    @staticmethod
    def _safe_run(runner: Callable[[str], None], session_id: str) -> None:
        try:
            runner(session_id)
        except Exception:  # pragma: no cover - orchestrator already guards
            logger.exception("Unhandled error in job for session %s", session_id)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
