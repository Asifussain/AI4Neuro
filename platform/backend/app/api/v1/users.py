"""User endpoints (doc 5.1 / 14.8)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.security import Principal
from app.schemas.users import UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_me(principal: Principal = Depends(get_current_user)) -> UserResponse:
    """Return the caller's canonical backend profile (role/hospital/status).

    Shape-compatible with GET /hospital/users/{id} (both are UserResponse)
    instead of the old ad-hoc dict; ``profile`` carries the full raw
    user_profiles row (role-detail bag included) for callers that need more
    than the flattened top-level fields.
    """
    profile = principal.profile or {}
    return UserResponse(
        id=principal.user_id,
        hospital_id=principal.hospital_id,
        unique_identifier=profile.get("unique_identifier", ""),
        full_name=profile.get("full_name", ""),
        email=principal.email or profile.get("email", "") or "",
        phone=profile.get("phone", ""),
        role=principal.role or "",
        account_status=principal.status or ("active" if principal.is_dev else ""),
        created_at=profile.get("created_at"),
        updated_at=profile.get("updated_at"),
        profile=profile,
    )
