"""StorageService signed-URL tests.

Report PDFs are generated once and their signed URL stored as-is (see
app/services/reports.py). The embedded JWT expires ~1h after generation, so
any report viewed later than that fails with
``InvalidJWT: "exp" claim timestamp check failed``. refresh_signed_url()
re-signs a stored URL so callers can mint a fresh token at read time instead
of serving back a URL that may already be stale.
"""

from __future__ import annotations

from app.services.storage import StorageService
from tests.fake_supabase import FakeSupabase


def test_refresh_signed_url_reissues_a_fresh_token():
    fake = FakeSupabase()
    storage = StorageService(client=fake)

    original = storage.create_signed_url("reports", "sess-1/technical.pdf")
    assert "/object/sign/reports/sess-1/technical.pdf" in original

    refreshed = storage.refresh_signed_url(original)

    assert refreshed is not None
    assert "/object/sign/reports/sess-1/technical.pdf" in refreshed
    # A fresh token was actually minted, not the same cached one returned.
    assert refreshed != original


def test_refresh_signed_url_passes_through_non_signed_urls():
    storage = StorageService(client=FakeSupabase())

    assert storage.refresh_signed_url(None) is None
    assert storage.refresh_signed_url("") == ""
    assert storage.refresh_signed_url("https://example.com/not-a-signed-url") == (
        "https://example.com/not-a-signed-url"
    )


def test_refresh_signed_url_survives_backend_errors(monkeypatch):
    fake = FakeSupabase()
    storage = StorageService(client=fake)
    original = storage.create_signed_url("reports", "sess-1/technical.pdf")

    def boom(*_a, **_k):
        raise RuntimeError("storage backend unavailable")

    monkeypatch.setattr(storage, "create_signed_url", boom)

    # Falls back to the original URL rather than raising - a failed refresh
    # must never break the read that triggered it.
    assert storage.refresh_signed_url(original) == original
