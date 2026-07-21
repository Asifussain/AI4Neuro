"""Schema for the platform audit trail (read-only; writes go through
DatabaseService.insert_audit_log directly from the mutating routes)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AuditLogEntry(BaseModel):
    id: str
    actor_id: str | None = None
    actor_role: str | None = None
    hospital_id: str | None = None
    action: str
    target_table: str | None = None
    target_id: str | None = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime | None = None
