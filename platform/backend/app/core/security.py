"""Authentication guard.

Verifies Supabase-issued access tokens (``Authorization: Bearer <token>``) using
the project's JWT secret (HS256), per doc 14.2. The old Flask backends had **no**
backend auth and trusted client-supplied ids; this closes that gap.

For the foundation, ``AUTH_DEV_BYPASS`` lets the app run before profiles/roles are
fully wired (Phase 5): when enabled and no valid token is present, a dev principal
is injected. It MUST be disabled in production (enforced below).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

DEV_PRINCIPAL_ID = "00000000-0000-0000-0000-000000000000"


@dataclass
class Principal:
    """The authenticated caller."""

    user_id: str
    email: str | None = None
    role: str | None = None
    is_dev: bool = False
    claims: dict = field(default_factory=dict)


def _decode_token(token: str, secret: str) -> dict:
    import jwt  # PyJWT

    return jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        audience="authenticated",
        options={"verify_aud": False},  # Supabase aud can vary; verify signature+exp
    )


def get_current_principal(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> Principal:
    """FastAPI dependency resolving the current authenticated principal."""
    token = _extract_bearer(authorization)

    if token and settings.supabase_jwt_secret:
        try:
            claims = _decode_token(token, settings.supabase_jwt_secret)
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
