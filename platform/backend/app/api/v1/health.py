"""Health endpoints (doc 5.1)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import get_settings
from app.services.supabase_client import get_service_client

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health() -> dict:
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/database")
def health_database() -> dict:
    """Report whether Supabase is configured (does not run a query in MVP)."""
    settings = get_settings()
    configured = bool(settings.supabase_url and settings.supabase_service_role_key)
    return {
        "status": "ok" if configured else "not_configured",
        "configured": configured,
    }


@router.get("/storage")
def health_storage() -> dict:
    settings = get_settings()
    configured = get_service_client() is not None
    return {
        "status": "ok" if configured else "not_configured",
        "configured": configured,
        "buckets": {
            "raw_files": settings.raw_files_bucket,
            "report_assets": settings.report_assets_bucket,
            "reports": settings.reports_bucket,
            "viewer_slices": settings.viewer_slices_bucket,
        },
    }
