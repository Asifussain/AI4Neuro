"""Storage service — the single adapter over Supabase Storage.

Handles raw-file upload/download and result-artifact upload, and issues signed
URLs for private buckets (doc 7.2 / 14.5). Client is injected for testability.
Paths follow the doc's layout, e.g. ``raw-files/eeg/{session_id}/input.npy``.
"""

from __future__ import annotations

import os
import tempfile
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.supabase_client import get_service_client, require_client

logger = get_logger(__name__)


class StorageService:
    def __init__(self, client: Any | None = None) -> None:
        self._client = client if client is not None else get_service_client()
        self._settings = get_settings()

    @property
    def client(self) -> Any:
        return require_client(self._client)

    # ------------------------------ raw files ------------------------------ #

    def raw_file_path(self, modality: str, session_id: str, filename: str) -> str:
        return f"{modality}/{session_id}/{filename}"

    def upload_raw_file(
        self, *, modality: str, session_id: str, filename: str, data: bytes
    ) -> tuple[str, str]:
        """Upload raw input; return (bucket, path)."""
        bucket = self._settings.raw_files_bucket
        path = self.raw_file_path(modality, session_id, filename)
        self._upload(bucket, path, data, _content_type_for(filename))
        return bucket, path

    def download_raw_file(self, session: dict, *, dest_dir: str | None = None) -> str:
        """Download a session's raw file to a local temp path and return it."""
        bucket = session.get("raw_file_bucket") or self._settings.raw_files_bucket
        path = session.get("raw_file_path")
        if not path:
            raise ValueError(f"Session {session.get('id')} has no raw_file_path.")
        data = self.client.storage.from_(bucket).download(path)
        if not isinstance(data, (bytes, bytearray)):
            raise RuntimeError(f"Unexpected download payload for {bucket}/{path}.")
        dest_dir = dest_dir or os.path.join(
            self._settings.local_tmp_dir, str(session.get("id"))
        )
        os.makedirs(dest_dir, exist_ok=True)
        local_path = os.path.join(dest_dir, os.path.basename(path))
        with open(local_path, "wb") as fh:
            fh.write(data)
        return local_path

    # ------------------------------ artifacts ------------------------------ #

    def upload_artifacts(self, session_id: str, artifacts: dict[str, str]) -> dict[str, str]:
        """Upload local artifact files to report-assets; return {key: signed_url}."""
        bucket = self._settings.report_assets_bucket
        urls: dict[str, str] = {}
        for key, local_path in artifacts.items():
            if not local_path or not os.path.exists(local_path):
                logger.warning("Artifact %s missing at %s; skipping.", key, local_path)
                continue
            filename = os.path.basename(local_path)
            path = f"{session_id}/{filename}"
            with open(local_path, "rb") as fh:
                self._upload(bucket, path, fh.read(), _content_type_for(filename))
            urls[key] = self.create_signed_url(bucket, path)
        return urls

    def upload_bytes(
        self, *, bucket: str, path: str, data: bytes, content_type: str
    ) -> str:
        self._upload(bucket, path, data, content_type)
        return self.create_signed_url(bucket, path)

    def create_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        res = self.client.storage.from_(bucket).create_signed_url(path, expires_in)
        # supabase-py returns {"signedURL": ...} or {"signed_url": ...} across versions
        if isinstance(res, dict):
            return res.get("signedURL") or res.get("signed_url") or res.get("signedUrl") or ""
        return str(res)

    # ------------------------------- internal ------------------------------ #

    def _upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        self.client.storage.from_(bucket).upload(
            path,
            data,
            {"content-type": content_type, "upsert": "true"},
        )


def _content_type_for(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".pdf"):
        return "application/pdf"
    if lower.endswith(".json"):
        return "application/json"
    return "application/octet-stream"


def new_temp_dir(session_id: str) -> str:
    base = os.path.join(get_settings().local_tmp_dir, session_id)
    os.makedirs(base, exist_ok=True)
    return tempfile.mkdtemp(dir=base)
