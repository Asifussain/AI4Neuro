"""Shared FastAPI dependencies (service accessors + auth enrichment).

Kept trivial so routes stay thin. Each request gets service instances bound to the
configured Supabase client; tests override these via ``app.dependency_overrides``.
"""

from __future__ import annotations

import httpx
from fastapi import Depends, HTTPException, status

from app.core.security import Principal, get_current_principal
from app.services.auth_admin import AuthAdminService
from app.services.database import DatabaseService
from app.services.storage import StorageService


def get_database() -> DatabaseService:
    return DatabaseService()


def get_storage() -> StorageService:
    return StorageService()


def get_auth_admin() -> AuthAdminService:
    from app.services.supabase_client import get_service_client

    return AuthAdminService(client=get_service_client())


def get_current_user(
    principal: Principal = Depends(get_current_principal),
    db: DatabaseService = Depends(get_database),
) -> Principal:
    """Resolve the caller and enrich it with the app-level user_profiles row.

    Enforces that the account is active (doc 14.2). The dev principal (bypass) is
    returned as-is so local/dev works before real profiles exist.
    """
    if principal.is_dev:
        return principal

    try:
        profile = db.get_user_profile(principal.user_id)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "supabase_unavailable",
                "message": "Could not reach Supabase while loading your profile. Please retry.",
            },
        ) from exc
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "no_profile", "message": "No user profile found."},
        )
    if profile.get("account_status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "account_not_active", "message": "Account is not active."},
        )
    principal.role = profile.get("role")
    principal.hospital_id = profile.get("hospital_id")
    principal.status = profile.get("account_status")
    principal.profile = profile
    return principal


def require_role(*roles: str):
    """FastAPI dependency factory: 403s unless the caller's role is in ``roles``.

    Route-level guard layered *on top of* the ``permissions.py`` predicates
    (the authorization source of truth), not a replacement for them — routes
    protected by this dependency still re-check the relevant permissions.py
    predicate in the function body for defense in depth. Used to make
    super_admin-only route groups (platform_admin.py) enforceable from route
    registration alone, instead of only via in-function role branching.
    """

    def _dependency(principal: Principal = Depends(get_current_user)) -> Principal:
        if principal.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "permission_denied",
                    "message": f"This action requires one of: {', '.join(roles)}.",
                },
            )
        return principal

    return _dependency
