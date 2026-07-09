"""Shared pytest fixtures.

Wires the app to an in-memory FakeSupabase and runs jobs synchronously so a
POST /analysis has finished processing by the time the test polls status.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_database, get_storage
from app.main import create_app
from app.services.database import DatabaseService
from app.services.jobs import JobService, set_job_service
from app.services.orchestrator import run_analysis_job
from app.services.storage import StorageService
from tests.fake_supabase import FakeSupabase


class SyncJobService(JobService):
    """Runs the orchestrator inline against the shared fake services."""

    def __init__(self, db: DatabaseService, storage: StorageService) -> None:
        self._db = db
        self._storage = storage

    def enqueue_analysis(self, session_id: str) -> None:
        run_analysis_job(session_id, db=self._db, storage=self._storage)


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
def client(
    db_service: DatabaseService, storage_service: StorageService
) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_database] = lambda: db_service
    app.dependency_overrides[get_storage] = lambda: storage_service
    with TestClient(app) as c:
        # Replace the LocalJobService (set during startup) with a synchronous one
        # bound to the same fake store the routes use.
        set_job_service(SyncJobService(db_service, storage_service))
        yield c
