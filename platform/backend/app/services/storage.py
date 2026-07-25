"""Storage service — the single adapter over Supabase Storage.

Handles raw-file upload/download and result-artifact upload, and issues signed
URLs for private buckets (doc 7.2 / 14.5). Client is injected for testability.
Paths follow the doc's layout, e.g. ``raw-files/eeg/{session_id}/input.npy``.
"""

from __future__ import annotations

import os
import re
import tempfile
from typing import Any
from urllib.parse import urlsplit

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

    def upload_viewer_slices(
        self, session_id: str, viewer_slices: dict[str, list[str]]
    ) -> dict[str, list[str]]:
        """Upload MRI viewer slices to the viewer-slices bucket.

        Input: ``{orientation: [local_png_path, ...]}``.
        Returns ``{orientation: [signed_url, ...]}`` at
        ``viewer-slices/{session_id}/{orientation}/slice_NNN.png``.
        """
        bucket = self._settings.viewer_slices_bucket
        urls: dict[str, list[str]] = {}
        for orientation, paths in viewer_slices.items():
            orientation_urls: list[str] = []
            for local_path in paths:
                if not local_path or not os.path.exists(local_path):
                    continue
                filename = os.path.basename(local_path)
                storage_path = f"{session_id}/{orientation}/{filename}"
                with open(local_path, "rb") as fh:
                    self._upload(bucket, storage_path, fh.read(), "image/png")
                orientation_urls.append(self.create_signed_url(bucket, storage_path))
            if orientation_urls:
                urls[orientation] = orientation_urls
        return urls

    def upload_explainability(self, session_id: str, explainability: dict | None) -> dict | None:
        """Persist the in-process explainability payload (Grad-CAM overlays +
        MNI152 reference images, held as base64 data-URIs) to storage so the web
        viewers can render the same visual evidence as the PDF.

        Returns a JSON-serialisable structure with signed image URLs (or
        ``None`` when there's nothing to persist)::

            {"method", "regions", "summary",
             "panels": [{"plane", "caption", "observations",
                         "affected_url", "reference_url"}, ...]}
        """
        if not explainability or not explainability.get("panels"):
            return None
        import base64

        bucket = self._settings.report_assets_bucket
        panels_out: list[dict] = []
        for i, panel in enumerate(explainability.get("panels", [])):
            out = {
                "plane": panel.get("plane"),
                "caption": panel.get("caption"),
                "observations": panel.get("observations") or [],
                "affected_url": None,
                "reference_url": None,
            }
            for key, dst in (("affected_image", "affected_url"), ("reference_image", "reference_url")):
                data_uri = panel.get(key)
                if not data_uri or not isinstance(data_uri, str):
                    continue
                try:
                    raw = data_uri.split(",", 1)[1] if data_uri.startswith("data:") else data_uri
                    img = base64.b64decode(raw)
                    path = f"{session_id}/explainability/panel_{i}_{dst.split('_')[0]}.png"
                    self._upload(bucket, path, img, "image/png")
                    out[dst] = self.create_signed_url(bucket, path)
                except Exception:  # noqa: BLE001 - one bad image must not drop the section
                    continue
            panels_out.append(out)

        return {
            "method": explainability.get("method"),
            "regions": explainability.get("regions") or [],
            "summary": explainability.get("summary"),
            "panels": panels_out,
        }

    def refresh_explainability(self, explainability: dict | None) -> dict | None:
        """Re-sign the stored explainability image URLs (signed URLs expire),
        mirroring ``refresh_signed_url`` for report PDFs."""
        if not explainability or not isinstance(explainability, dict):
            return explainability
        panels = []
        for panel in explainability.get("panels", []) or []:
            panels.append(
                {
                    **panel,
                    "affected_url": self.refresh_signed_url(panel.get("affected_url")),
                    "reference_url": self.refresh_signed_url(panel.get("reference_url")),
                }
            )
        return {**explainability, "panels": panels}

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

    # Matches .../storage/v1/object/sign/{bucket}/{path...}?token=...
    _SIGNED_URL_PATH_RE = re.compile(r"/object/sign/(?P<bucket>[^/]+)/(?P<path>.+)$")

    def refresh_signed_url(self, url: str | None, expires_in: int = 3600) -> str | None:
        """Re-sign a previously issued signed URL.

        Signed URLs embed a JWT with a short-lived ``exp`` claim (1h by
        default). Report URLs are generated once at report-creation time and
        then served back verbatim on every later read, so any view attempted
        after that window produces ``InvalidJWT: "exp" claim timestamp check
        failed``. Callers that serve a stored signed URL back to a client
        should refresh it first so the token is valid from the moment it's
        handed out, not from whenever the report happened to be generated.

        Returns the original value unchanged if it isn't a recognised signed
        storage URL (e.g. already null, or some other kind of link).
        """
        if not url:
            return url
        try:
            match = self._SIGNED_URL_PATH_RE.search(urlsplit(url).path)
            if not match:
                return url
            return self.create_signed_url(
                match.group("bucket"), match.group("path"), expires_in
            )
        except Exception as exc:  # noqa: BLE001 - never break a read on refresh failure
            logger.warning("Could not refresh signed URL: %s", exc)
            return url

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
