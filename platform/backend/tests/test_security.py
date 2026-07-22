"""JWT verification tests for get_current_principal.

The rest of the suite injects a Principal directly via
app.dependency_overrides[get_current_user] — good for testing route-level
authorization logic, but it never exercises actual JWT parsing/verification.
This tests that layer directly: a real signature check, real expiry check,
and the classic algorithm-confusion attack (alg=none).
"""

from __future__ import annotations

import time

import jwt
import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.core.security import get_current_principal

SECRET = "test-jwt-secret-do-not-use-in-prod"


def _settings(**overrides) -> Settings:
    defaults = dict(APP_ENV="production", AUTH_DEV_BYPASS=False, SUPABASE_JWT_SECRET=SECRET)
    defaults.update(overrides)
    return Settings(**defaults)


def _token(*, secret=SECRET, algorithm="HS256", exp_delta=3600, **claims) -> str:
    payload = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "email": "user@example.com",
        "exp": int(time.time()) + exp_delta,
        **claims,
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def test_valid_token_resolves_a_principal():
    token = _token()
    principal = get_current_principal(authorization=f"Bearer {token}", settings=_settings())
    assert principal.user_id == "11111111-1111-1111-1111-111111111111"
    assert principal.email == "user@example.com"


def test_tampered_signature_is_rejected():
    token = _token(secret="a-completely-different-secret-of-sufficient-length")
    with pytest.raises(HTTPException) as exc_info:
        get_current_principal(authorization=f"Bearer {token}", settings=_settings())
    assert exc_info.value.status_code == 401


def test_expired_token_is_rejected():
    token = _token(exp_delta=-3600)  # expired an hour ago
    with pytest.raises(HTTPException) as exc_info:
        get_current_principal(authorization=f"Bearer {token}", settings=_settings())
    assert exc_info.value.status_code == 401


def test_algorithm_none_confusion_attack_is_rejected():
    # The classic JWT vulnerability: claim alg=none and omit the signature
    # entirely, hoping a naive verifier skips signature checking. PyJWT
    # itself refuses to encode with alg=none unless explicitly allowed, so
    # this constructs the raw token by hand to make sure the *decode* side
    # (get_current_principal / _decode_token) rejects it regardless.
    import base64
    import json

    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=")
    payload = base64.urlsafe_b64encode(
        json.dumps({"sub": "attacker", "role": "super_admin", "exp": int(time.time()) + 3600}).encode()
    ).rstrip(b"=")
    forged_token = (header + b"." + payload + b".").decode()

    with pytest.raises(HTTPException) as exc_info:
        get_current_principal(authorization=f"Bearer {forged_token}", settings=_settings())
    assert exc_info.value.status_code == 401


def test_no_token_is_rejected_when_dev_bypass_disabled():
    with pytest.raises(HTTPException) as exc_info:
        get_current_principal(authorization=None, settings=_settings())
    assert exc_info.value.status_code == 401


def test_no_token_falls_back_to_dev_principal_only_in_development():
    settings = _settings(APP_ENV="development", AUTH_DEV_BYPASS=True)
    principal = get_current_principal(authorization=None, settings=settings)
    assert principal.is_dev is True
    assert principal.role == "super_admin"


def test_garbage_authorization_header_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        get_current_principal(authorization="not-a-bearer-token", settings=_settings())
    assert exc_info.value.status_code == 401
