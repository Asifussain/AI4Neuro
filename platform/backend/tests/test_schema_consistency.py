"""Guardrails that the SQL schema agrees with the backend's expectations.

The user-creation flow broke in production even though every behavioral test
passed, because the in-memory fake Supabase used by those tests does not
enforce Postgres CHECK constraints. These tests close that gap by reading the
actual SQL and asserting it accepts exactly the values the backend writes:

  * every ``Role`` enum value must be allowed by the ``user_profiles`` role
    CHECK constraint (the regression: the DB only allowed ``hospital_admin``
    while the backend writes ``admin``);
  * ``hospitals`` must have a ``created_by`` column (the source of the
    "Could not find the 'created_by' column of 'hospitals'" error).

These parse SQL text rather than run Postgres, so they stay dependency-free and
fast while still catching a whole-app-breaking divergence.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.schemas.users import Role

REPO_ROOT = Path(__file__).resolve().parents[3]
FULL_SETUP = REPO_ROOT / "supabase" / "setup" / "full_setup.sql"
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"


def _role_check_values(sql: str) -> set[str]:
    """Extract the value set from the LAST ``role in (...)`` CHECK in the SQL
    (the final constraint definition wins after any earlier drops/re-adds)."""
    matches = re.findall(r"role\s+in\s*\(([^)]*)\)", sql, flags=re.IGNORECASE)
    assert matches, "no role CHECK constraint found in SQL"
    return {v.strip().strip("'\"") for v in matches[-1].split(",")}


def test_full_setup_role_check_accepts_every_backend_role():
    allowed = _role_check_values(FULL_SETUP.read_text())
    backend_roles = {r.value for r in Role}
    missing = backend_roles - allowed
    assert not missing, (
        f"full_setup.sql role CHECK rejects backend role value(s) {missing}; "
        f"CHECK allows {allowed}. The whole user-creation flow fails when the "
        f"DB constraint disagrees with the Role enum."
    )


def test_final_migration_realigns_role_check_to_backend_roles():
    """The newest migration that (re)defines the role CHECK must accept every
    backend role value, so an already-deployed DB can be brought back in sync."""
    migrations = sorted(MIGRATIONS_DIR.glob("*.sql"))
    role_check_migrations = [m for m in migrations if re.search(r"role\s+in\s*\(", m.read_text(), re.IGNORECASE)]
    assert role_check_migrations, "no migration defines a role CHECK"
    latest = role_check_migrations[-1]
    allowed = _role_check_values(latest.read_text())
    backend_roles = {r.value for r in Role}
    missing = backend_roles - allowed
    assert not missing, (
        f"{latest.name} role CHECK rejects backend role value(s) {missing}; "
        f"allows {allowed}."
    )


def test_hospital_admin_role_value_is_admin_not_hospital_admin():
    # The canonical wire/DB value is ``admin`` (documented on the Role enum and
    # mirrored in the frontend). Regression guard against a re-rename.
    assert Role.hospital_admin.value == "admin"


def test_hospitals_has_created_by_column():
    setup = FULL_SETUP.read_text()
    assert re.search(
        r"hospitals\s+add\s+column\s+if\s+not\s+exists\s+created_by", setup, re.IGNORECASE
    ) or re.search(r"created_by\s+uuid", setup, re.IGNORECASE), (
        "hospitals.created_by column missing from full_setup.sql"
    )


def test_schema_reloads_postgrest_cache():
    """Both the fresh-install script and the realignment migration must reload
    the PostgREST schema cache so new columns are visible immediately (the
    'schema cache' half of the reported error)."""
    assert "notify pgrst" in FULL_SETUP.read_text().lower()
    latest = sorted(MIGRATIONS_DIR.glob("*.sql"))[-1]
    assert "notify pgrst" in latest.read_text().lower()
