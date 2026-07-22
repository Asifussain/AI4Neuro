"""Shared pytest fixtures.

Wires the app to an in-memory FakeSupabase and runs jobs synchronously so a
POST /analysis has finished processing by the time the test polls status.
"""

from __future__ import annotations

import os

# The test client fixture below doesn't override the auth dependency, so it
# relies on the dev-bypass principal — explicitly opt into exactly the one
# combination that enables it (APP_ENV=development is the test suite's own
# environment anyway), rather than depending on either value's default.
# Must run before any app module (which calls get_settings(), lru_cached on
# first call) is imported.
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("AUTH_DEV_BYPASS", "true")

import uuid

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_auth_admin, get_database, get_storage
from app.main import create_app
from app.services.database import DatabaseService
from app.services.jobs import JobService, set_job_service
from app.services.orchestrator import run_analysis_job
from app.services.rate_limit import RateLimiter, get_rate_limiter
from app.services.reports import NoopReportService
from app.services.storage import StorageService
from tests.fake_supabase import FakeSupabase


class FakeAuthAdminService:
    """In-memory stand-in for AuthAdminService — no real Supabase Auth calls.

    Tracks created user ids so tests can assert on rollback (delete_auth_user
    called after a downstream failure).
    """

    def __init__(self) -> None:
        self.created: dict[str, dict] = {}
        self.deleted: list[str] = []

    def create_auth_user(self, *, email: str, full_name: str, role: str, password: str | None = None) -> dict:
        user_id = str(uuid.uuid4())
        password = password or "Temp1234!fake"
        record = {"id": user_id, "email": email, "temporary_password": password}
        self.created[user_id] = record
        return record

    def delete_auth_user(self, user_id: str) -> None:
        self.deleted.append(user_id)
        self.created.pop(user_id, None)


class SyncJobService(JobService):
    """Runs the orchestrator inline against the shared fake services.

    Uses NoopReportService so the foundation flow tests (stub pipelines) stay
    hermetic and independent of the PDF stack; report generation is covered
    directly in test_reports.py.
    """

    def __init__(self, db: DatabaseService, storage: StorageService) -> None:
        self._db = db
        self._storage = storage

    def enqueue_analysis(self, session_id: str) -> None:
        run_analysis_job(
            session_id, db=self._db, storage=self._storage,
            reports=NoopReportService(),
        )


@pytest.fixture
def fake_supabase() -> FakeSupabase:
    return FakeSupabase()


@pytest.fixture
def db_service(fake_supabase: FakeSupabase) -> DatabaseService:
    return DatabaseService(client=fake_supabase)


@pytest.fixture
def storage_service(fake_supabase: FakeSupabase) -> StorageService:
    return StorageService(client=fake_supabase)


@pytest.fixture
def fake_auth_admin() -> FakeAuthAdminService:
    return FakeAuthAdminService()


@pytest.fixture
def rate_limiter() -> RateLimiter:
    # A fixture (not an inline lambda in the override below) specifically so
    # every request *within one test* shares this same instance — a lambda
    # constructing `RateLimiter()` fresh would hand every request its own
    # empty limiter, defeating rate limiting entirely. Fresh per *test*
    # (not the production module-level singleton) so tests sharing the same
    # dev-bypass principal id don't leak rate-limit state into each other.
    return RateLimiter()


@pytest.fixture
def client(
    db_service: DatabaseService,
    storage_service: StorageService,
    fake_auth_admin: FakeAuthAdminService,
    rate_limiter: RateLimiter,
) -> TestClient:
    from app.pipelines.base import register_pipeline, stub_runner_factory

    app = create_app()
    app.dependency_overrides[get_database] = lambda: db_service
    app.dependency_overrides[get_storage] = lambda: storage_service
    app.dependency_overrides[get_auth_admin] = lambda: fake_auth_admin
    app.dependency_overrides[get_rate_limiter] = lambda: rate_limiter
    with TestClient(app) as c:
        # Force deterministic stub pipelines so foundation tests never depend on
        # torch/weights (real EEG is covered separately in test_eeg_pipeline.py).
        register_pipeline("eeg", stub_runner_factory("eeg"))
        register_pipeline("mri", stub_runner_factory("mri"))
        # Replace the LocalJobService (set during startup) with a synchronous one
        # bound to the same fake store the routes use.
        set_job_service(SyncJobService(db_service, storage_service))
        yield c
