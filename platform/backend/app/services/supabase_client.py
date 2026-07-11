"""Supabase client factory.

Centralizes creation of the service-role Supabase client so the rest of the
backend never calls ``create_client`` directly. Returns ``None`` when Supabase is
not configured, letting the app boot for local/dev + tests without secrets;
callers that require it raise a clear error via ``require_client``.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@lru_cache
def get_service_client() -> Any | None:
    """Build (once) a Supabase client using the service-role key, or None."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("Supabase not configured; DB/storage operations disabled.")
        return None
    try:
        from supabase import ClientOptions, create_client
    except ImportError:  # pragma: no cover - supabase always in api.txt
        logger.error("supabase package not installed.")
        return None
    try:
        # postgrest-py 2.31 defaults to HTTP/2. Supabase occasionally closes
        # local dev HTTP/2 streams mid-request, so keep this backend on HTTP/1.1.
        http_client = httpx.Client(
            follow_redirects=True,
            http2=False,
            timeout=httpx.Timeout(120.0, connect=10.0),
        )
        options = ClientOptions(httpx_client=http_client)
        return create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
            options=options,
        )
    except Exception as exc:
        logger.error("Failed to initialize Supabase client: %s", exc)
        return None


class SupabaseNotConfiguredError(RuntimeError):
    """Raised when an operation needs Supabase but it is not configured."""


def require_client(client: Any | None) -> Any:
    if client is None:
        raise SupabaseNotConfiguredError(
            "Supabase is not configured. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY."
        )
    return client
