"""Supabase Auth Admin provisioning — the backend's half of user creation.

Mirrors ``platform/frontend/src/app/api/admin/create-user/route.ts`` (Next.js,
Supabase Auth Admin API + service-role key) so the backend can create a fully
login-capable account (Auth user + user_profiles + role-detail row) on its
own, atomically, without depending on the frontend route. That frontend route
is left untouched; retiring it in favor of this one is a later, separate pass.

Uses the same service-role Supabase client the rest of the backend already
uses for DB access (``app.services.supabase_client.get_service_client``) —
the supabase-py client's ``auth.admin`` namespace talks to the GoTrue Admin
API using that same service-role key.
"""

from __future__ import annotations

import secrets
import string
from typing import Any

from app.core.logging import get_logger
from app.services.supabase_client import require_client

logger = get_logger(__name__)

_PASSWORD_CHARSET = string.ascii_letters + string.digits + "!@#$%^&*"


class AuthProvisioningError(RuntimeError):
    """Raised when Supabase Auth Admin user creation fails."""


def generate_temporary_password(length: int = 12) -> str:
    return "".join(secrets.choice(_PASSWORD_CHARSET) for _ in range(length))


class AuthAdminService:
    """Thin wrapper over supabase-py's ``client.auth.admin`` methods."""

    def __init__(self, client: Any | None = None) -> None:
        self._client = client

    @property
    def client(self) -> Any:
        return require_client(self._client)

    def create_auth_user(
        self, *, email: str, full_name: str, role: str, password: str | None = None
    ) -> dict:
        """Create a Supabase Auth user with a temporary password.

        Mirrors the Next.js route's ``supabaseAdmin.auth.admin.createUser``
        call: email pre-confirmed, ``user_metadata`` carries full_name/role/
        first_login so the frontend can force a password change on first
        login. Returns a dict with at least ``id``.
        """
        password = password or generate_temporary_password()
        try:
            result = self.client.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {
                        "full_name": full_name,
                        "role": role,
                        "first_login": True,
                    },
                }
            )
        except Exception as exc:  # supabase-py raises its own AuthApiError etc.
            raise AuthProvisioningError(f"Failed to create Auth user: {exc}") from exc

        user = getattr(result, "user", None) or (result.get("user") if isinstance(result, dict) else None)
        if not user:
            raise AuthProvisioningError("Auth user creation returned no user.")
        user_id = getattr(user, "id", None) or (user.get("id") if isinstance(user, dict) else None)
        if not user_id:
            raise AuthProvisioningError("Auth user creation returned no id.")
        return {"id": str(user_id), "email": email, "temporary_password": password}

    def delete_auth_user(self, user_id: str) -> None:
        """Rollback helper: delete an Auth user, e.g. after a downstream
        user_profiles/role-profile insert fails, so no orphaned login-capable
        account is left behind. Best-effort — logs rather than raising, since
        this itself runs inside an already-failing error path."""
        try:
            self.client.auth.admin.delete_user(user_id)
        except Exception as exc:
            logger.error("Failed to rollback Auth user %s after provisioning failure: %s", user_id, exc)
