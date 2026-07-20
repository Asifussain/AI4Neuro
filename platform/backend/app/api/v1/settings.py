"""Platform settings API — out of scope for the Part 1 redesign.

Split out of the old admin.py verbatim (same bare ``/settings`` path, same
behavior) so it keeps working unchanged while admin.py is retired in favor of
platform_admin.py / hospital_admin.py.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, get_database
from app.core.security import Principal
from app.schemas.users import PlatformSettingsResponse, PlatformSettingsUpdate
from app.services import permissions
from app.services.database import DatabaseService

router = APIRouter(tags=["settings"])


@router.get("/settings", response_model=PlatformSettingsResponse)
def get_settings_(
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PlatformSettingsResponse:
    if not permissions.can_manage_platform_settings(principal.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "permission_denied", "message": "Only Super Admins may view platform settings."},
        )
    res = db.client.table("platform_settings").select("*").eq("id", True).maybe_single().execute()
    row = getattr(res, "data", None) or {"settings": {}}
    return PlatformSettingsResponse(**row)


@router.patch("/settings", response_model=PlatformSettingsResponse)
def update_settings(
    payload: PlatformSettingsUpdate,
    principal: Principal = Depends(get_current_user),
    db: DatabaseService = Depends(get_database),
) -> PlatformSettingsResponse:
    if not permissions.can_manage_platform_settings(principal.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "permission_denied", "message": "Only Super Admins may update platform settings."},
        )
    patch = {
        "settings": payload.settings,
        "updated_by": None if principal.is_dev else principal.user_id,
    }
    db.client.table("platform_settings").update(patch).eq("id", True).execute()
    res = db.client.table("platform_settings").select("*").eq("id", True).maybe_single().execute()
    row = getattr(res, "data", None) or {"settings": payload.settings}
    return PlatformSettingsResponse(**row)
