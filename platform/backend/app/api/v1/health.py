"""Health endpoints (doc 5.1)."""

from __future__ import annotations

import asyncio

from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.supabase_client import get_service_client

logger = get_logger(__name__)

router = APIRouter(prefix="/health", tags=["health"])

# Short and bounded on purpose: a hung Supabase dependency must fail this
# check fast rather than let the check itself hang (and pile up) behind it.
_HEALTH_CHECK_TIMEOUT_SECONDS = 3.0


class HealthResponse(BaseModel):
    status: str
    timestamp: str


class DatabaseHealthResponse(BaseModel):
    status: str
    configured: bool


class StorageBuckets(BaseModel):
    raw_files: str
    report_assets: str
    reports: str
    viewer_slices: str


class StorageHealthResponse(BaseModel):
    status: str
    configured: bool
    buckets: StorageBuckets


@router.get("", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", timestamp=datetime.now(timezone.utc).isoformat())


@router.get("/database", response_model=DatabaseHealthResponse)
async def health_database() -> DatabaseHealthResponse:
    """Report whether Supabase is configured AND actually reachable.

    Config-only checking (the previous behavior) reports "ok" even if
    Supabase is down or the service-role key was revoked — exactly when a
    health check matters most. A real, timeout-bounded round trip closes
    that gap without risking the check itself hanging on a dead dependency.
    """
    settings = get_settings()
    configured = bool(settings.supabase_url and settings.supabase_service_role_key)
    client = get_service_client()
    if not configured or client is None:
        return DatabaseHealthResponse(status="not_configured", configured=False)
    try:
        await asyncio.wait_for(
            asyncio.to_thread(lambda: client.table("hospitals").select("id").limit(1).execute()),
            timeout=_HEALTH_CHECK_TIMEOUT_SECONDS,
        )
        return DatabaseHealthResponse(status="ok", configured=True)
    except Exception:
        logger.warning("Database health check failed", exc_info=True)
        return DatabaseHealthResponse(status="error", configured=True)


@router.get("/storage", response_model=StorageHealthResponse)
async def health_storage() -> StorageHealthResponse:
    settings = get_settings()
    client = get_service_client()
    buckets = StorageBuckets(
        raw_files=settings.raw_files_bucket,
        report_assets=settings.report_assets_bucket,
        reports=settings.reports_bucket,
        viewer_slices=settings.viewer_slices_bucket,
    )
    if client is None:
        return StorageHealthResponse(status="not_configured", configured=False, buckets=buckets)
    try:
        await asyncio.wait_for(
            asyncio.to_thread(
                lambda: client.storage.from_(settings.raw_files_bucket).list(path="", options={"limit": 1})
            ),
            timeout=_HEALTH_CHECK_TIMEOUT_SECONDS,
        )
        return StorageHealthResponse(status="ok", configured=True, buckets=buckets)
    except Exception:
        logger.warning("Storage health check failed", exc_info=True)
        return StorageHealthResponse(status="error", configured=True, buckets=buckets)
