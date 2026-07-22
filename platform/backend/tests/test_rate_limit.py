"""Tests for the per-identity rate limiter and its wiring into routes."""

from __future__ import annotations

from fastapi import HTTPException

from app.api.deps import get_current_user
from app.core.security import Principal
from app.services.rate_limit import RateLimiter


def test_rate_limiter_allows_up_to_the_limit_then_blocks():
    limiter = RateLimiter()
    for _ in range(5):
        limiter.check("k", max_requests=5, window_seconds=60)  # must not raise
    try:
        limiter.check("k", max_requests=5, window_seconds=60)
        assert False, "6th call should have been rate-limited"
    except HTTPException as exc:
        assert exc.status_code == 429


def test_rate_limiter_keys_are_independent():
    limiter = RateLimiter()
    for _ in range(5):
        limiter.check("a", max_requests=5, window_seconds=60)
    # A different key has its own budget, unaffected by "a" being exhausted.
    limiter.check("b", max_requests=5, window_seconds=60)


def test_analysis_creation_is_rate_limited_per_caller(client, db_service):
    from tests.test_analysis_flow import _upload

    # Tiny limit so the test doesn't need 20+ requests — the `client` fixture
    # already wires a per-test (not per-request) RateLimiter instance.
    import app.core.config as config_module

    original_get_settings = config_module.get_settings

    def _patched_settings():
        # model_copy, not in-place mutation — get_settings() is lru_cached
        # and returns the same shared instance every call; mutating it
        # in place would leak into every other test in this process.
        return original_get_settings().model_copy(update={"rate_limit_analysis_per_minute": 2})

    client.app.dependency_overrides[config_module.get_settings] = _patched_settings

    ok1 = _upload(client, db_service, filename="a.npy")
    ok2 = _upload(client, db_service, filename="b.npy")
    blocked = _upload(client, db_service, filename="c.npy")

    assert ok1.status_code == 202
    assert ok2.status_code == 202
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limited"


def test_user_creation_is_rate_limited_per_caller(client, db_service):
    client.app.dependency_overrides[get_current_user] = lambda: Principal(
        user_id="ha1", role="admin", hospital_id="h1", is_dev=False
    )
    import app.core.config as config_module

    original_get_settings = config_module.get_settings

    def _patched_settings():
        return original_get_settings().model_copy(update={"rate_limit_user_creation_per_minute": 1})

    client.app.dependency_overrides[config_module.get_settings] = _patched_settings
    db_service.create_hospital({"hospital_code": "H1", "name": "H1", "address": "1 St", "id": "h1"})

    payload = {
        "full_name": "Dr. One",
        "email": "one@example.com",
        "phone": "555-0100",
        "role": "doctor",
    }
    ok = client.post("/api/v1/hospital/users", json=payload)
    blocked = client.post(
        "/api/v1/hospital/users",
        json={**payload, "email": "two@example.com"},
    )

    assert ok.status_code == 201
    assert blocked.status_code == 429
