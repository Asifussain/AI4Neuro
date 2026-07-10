"""User endpoints (doc 5.1 / 14.8)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.security import Principal

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
def get_me(principal: Principal = Depends(get_current_user)) -> dict:
    """Return the caller's canonical backend profile (role/hospital/status)."""
    return {
        "id": principal.user_id,
        "email": principal.email,
        "role": principal.role,
        "hospital_id": principal.hospital_id,
        "status": principal.status,
        "is_dev": principal.is_dev,
        "profile": principal.profile,
    }
