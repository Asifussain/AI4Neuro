"""Authentication guard.

Verifies Supabase-issued access tokens (``Authorization: Bearer <token>``).
Supabase projects may issue either legacy HS256 tokens signed with the project's
JWT secret, or newer asymmetric tokens (for example ES256) discoverable through
the project's JWKS endpoint. The old Flask backends had **no** backend auth and
trusted client-supplied ids; this closes that gap.

For the foundation, ``AUTH_DEV_BYPASS`` lets the app run before profiles/roles are
fully wired (Phase 5): when enabled and no valid token is present, a dev principal
is injected. It MUST be disabled in production (enforced below).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

DEV_PRINCIPAL_ID = "00000000-0000-0000-0000-000000000000"


@dataclass
class Principal:
    """The authenticated caller.

    ``role``/``hospital_id``/``status`` are the app-level values loaded from
    ``user_profiles`` (see ``api.deps.get_current_user``); the JWT only carries the
    Supabase auth identity. ``role`` may be pre-set from the token for the dev
    principal.
    """

    user_id: str
    email: str | None = None
    role: str | None = None
    hospital_id: str | None = None
    status: str | None = None
    is_dev: bool = False
    claims: dict = field(default_factory=dict)
    profile: dict = field(default_factory=dict)


def _decode_token(token: str, settings: Settings) -> dict:
    import jwt  # PyJWT

    header = jwt.get_unverified_header(token)
    algorithm = header.get("alg")

    if algorithm == "HS256" and settings.supabase_jwt_secret:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": False},  # Supabase aud can vary; verify signature+exp
        )

    if settings.supabase_url:
        signing_key = _jwks_client(settings.supabase_url).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            options={"verify_aud": False},
        )

    raise ValueError("Supabase JWT verification is not configured.")


@lru_cache(maxsize=8)
def _jwks_client(supabase_url: str):
    from jwt import PyJWKClient

    base = supabase_url.rstrip("/")
    return PyJWKClient(f"{base}/auth/v1/.well-known/jwks.json")


def get_current_principal(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> Principal:
    """FastAPI dependency resolving the current authenticated principal."""
    token = _extract_bearer(authorization)

    if token and (settings.supabase_jwt_secret or settings.supabase_url):
        try:
            claims = _decode_token(token, settings)
            return Principal(
                user_id=claims.get("sub", ""),
                email=claims.get("email"),
                role=claims.get("role"),
                claims=claims,
            )
        except Exception as exc:  # invalid/expired token
            logger.info("JWT verification failed: %s", exc)
            if not settings.auth_dev_bypass:
                raise _unauthorized("Invalid or expired token.") from exc

    # No/failed token below this point.
    if settings.auth_dev_bypass and not settings.is_production:
        return Principal(user_id=DEV_PRINCIPAL_ID, role="admin", is_dev=True)

    raise _unauthorized("Authentication required.")


def _extract_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "unauthorized", "message": message},
        headers={"WWW-Authenticate": "Bearer"},
    )
