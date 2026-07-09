"""Shared pipeline artifact helpers."""

from __future__ import annotations

import base64

from app.core.logging import get_logger

logger = get_logger(__name__)


def write_data_uri_png(data_uri: str | None, path: str) -> str | None:
    """Decode a base64 PNG (data-URI or bare base64) to a file; return its path.

    Returns None if there's nothing to write or the write fails — a missing plot
    must never fail the whole analysis job.
    """
    if not data_uri:
        return None
    b64 = data_uri.split(",", 1)[1] if data_uri.startswith("data:") else data_uri
    try:
        with open(path, "wb") as fh:
            fh.write(base64.b64decode(b64))
        return path
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed writing plot %s: %s", path, exc)
        return None
