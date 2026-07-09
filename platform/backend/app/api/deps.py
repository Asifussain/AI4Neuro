"""Shared FastAPI dependencies (service accessors).

Kept trivial so routes stay thin. Each request gets service instances bound to the
configured Supabase client; tests override these via ``app.dependency_overrides``.
"""

from __future__ import annotations

from app.services.database import DatabaseService
from app.services.storage import StorageService


def get_database() -> DatabaseService:
    return DatabaseService()


def get_storage() -> StorageService:
    return StorageService()
