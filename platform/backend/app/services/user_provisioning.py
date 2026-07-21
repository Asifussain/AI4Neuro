"""Atomic user provisioning: Supabase Auth account + user_profiles + role-detail row.

Single source of truth for "who can create whom" + the actual creation flow,
used by both ``POST /platform/users`` (admin/super_admin accounts) and
``POST /hospital/users`` (doctor/radiologist/patient accounts) so the logic
that used to live twice (an unused FastAPI route in the old admin.py, and the
Next.js frontend route ``platform/frontend/src/app/api/admin/create-user``)
lives exactly once here.

On any failure after the Auth user is created, the Auth user is rolled back
(deleted) so no orphaned login-capable account is left behind — mirroring the
rollback already done by the Next.js route.
"""

from __future__ import annotations

import random

from fastapi import HTTPException, status
from postgrest import APIError

from app.api.v1._common import ROLE_PROFILE_TABLE
from app.core.security import Principal
from app.schemas.users import UserCreate
from app.services import permissions
from app.services.auth_admin import AuthAdminService, AuthProvisioningError
from app.services.database import DatabaseService

_UNIQUE_ID_MAX_ATTEMPTS = 5


def _generate_unique_identifier(role: str) -> str:
    prefix = (role or "usr")[:2].upper()
    suffix = "".join(random.choices("0123456789", k=6))
    return f"{prefix}{suffix}"


def _is_generated_id_collision(exc: Exception) -> bool:
    """True only for a Postgres unique-violation on unique_identifier itself.

    Deliberately narrow: any other error (including a collision on a
    caller-supplied identifier, or an email collision) must still surface as
    a real failure rather than being silently retried away.
    """
    if not isinstance(exc, APIError):
        return False
    if getattr(exc, "code", None) != "23505":
        return False
    haystack = " ".join(filter(None, [exc.details, exc.message])).lower()
    return "unique_identifier" in haystack


def create_user_account(
    *,
    payload: UserCreate,
    principal: Principal,
    db: DatabaseService,
    auth_admin: AuthAdminService,
) -> dict:
    """Create a fully login-capable account and return the user row plus
    ``temporary_password`` (present only in this one response — never log
    or persist it elsewhere)."""
    target_role = payload.role.value
    target_hospital_id = payload.hospital_id if target_role != "super_admin" else None

    if principal.role == "admin":
        # A hospital_admin may only create into their own hospital.
        target_hospital_id = principal.hospital_id

    if not permissions.can_create_user_with_role(
        principal.role,
        target_role,
        actor_hospital_id=principal.hospital_id,
        target_hospital_id=target_hospital_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "permission_denied",
                "message": f"Your role may not create a {target_role} account.",
            },
        )

    if target_role != "super_admin" and not target_hospital_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "hospital_required", "message": "hospital_id is required for this role."},
        )

    # 1) Provision the Supabase Auth account (email/password login).
    try:
        auth_result = auth_admin.create_auth_user(
            email=payload.email, full_name=payload.full_name, role=target_role
        )
    except AuthProvisioningError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "auth_provisioning_failed", "message": str(exc)},
        ) from exc

    user_id = auth_result["id"]
    temporary_password = auth_result["temporary_password"]

    # 2) Create the user_profiles + role-detail rows, rolling back the Auth
    #    user on any failure so we never leave an orphaned login-capable
    #    account with no matching profile.
    base_row = {
        "id": user_id,
        "hospital_id": target_hospital_id,
        "full_name": payload.full_name,
        "email": payload.email,
        "phone": payload.phone,
        "date_of_birth": payload.date_of_birth.isoformat() if payload.date_of_birth else None,
        "address": payload.address,
        "role": target_role,
        "account_status": "active",
        "created_by_admin": None if principal.is_dev else principal.user_id,
    }

    user: dict | None = None
    try:
        for attempt in range(_UNIQUE_ID_MAX_ATTEMPTS):
            unique_identifier = payload.unique_identifier or _generate_unique_identifier(target_role)
            try:
                user = db.create_user_profile({**base_row, "unique_identifier": unique_identifier})
                break
            except Exception as exc:
                # Only retry a collision on an identifier *we* generated —
                # a caller-supplied identifier, or any other error (including
                # an email collision), must fail hard on the first attempt.
                if payload.unique_identifier or not _is_generated_id_collision(exc):
                    raise
        if user is None:
            raise RuntimeError(
                f"Could not generate a unique identifier after {_UNIQUE_ID_MAX_ATTEMPTS} attempts."
            )

        profile_table = ROLE_PROFILE_TABLE.get(target_role)
        if profile_table:
            db.create_role_profile(profile_table, {"user_id": user["id"]})

        db.insert_audit_log(
            actor_id=principal.user_id,
            actor_role=principal.role,
            hospital_id=target_hospital_id,
            action="user.create",
            target_table="user_profiles",
            target_id=user["id"],
            metadata={"role": target_role},
        )
    except Exception as exc:
        auth_admin.delete_auth_user(user_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "user_profile_create_failed",
                "message": "Auth account was created but the profile could not be saved; rolled back.",
            },
        ) from exc

    # TODO: wire "temporary_password" delivery to the org's chosen email
    # service (the Next.js route used nodemailer/SMTP; replicating that
    # template pipeline is out of scope for this pass). Until then, the
    # caller (an admin) is responsible for relaying the temporary password
    # from this one-time response.
    return {**user, "temporary_password": temporary_password}
