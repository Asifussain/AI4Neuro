# Multi-Tenant Architecture Refactor — Super Admin → Hospital Admin

**Status:** Analysis / Planning only. No code has been changed. This document is the
basis for a follow-up implementation phase.

**Scope of codebase analyzed:** `platform/` (the active unified app — Next.js frontend +
FastAPI backend + Supabase/Postgres), which is what this refactor targets.
`Alzheimer-Detection/` and `mri-platform/` are the legacy standalone apps that predate
`platform/` and are not part of this refactor; they are called out only where relevant.

---

## 1. Current vs Proposed Architecture

### 1.1 Current architecture

```
                    ┌──────────────────────────┐
                    │      Single Tenant        │
                    │   (hospitals table exists │
                    │  but is not enforced as a │
                    │   real isolation boundary)│
                    └──────────────┬─────────────┘
                                   │
        ┌───────────┬─────────────┼─────────────┬─────────────┐
        │           │             │             │             │
     admin       doctor      radiologist    technician     patient
  (full access) (assigned   (own uploads/  (own EEG       (own
                 patients)   sessions)      uploads)       sessions)
```

Key facts, grounded in the current code:

- `user_profiles.role` CHECK constraint allows exactly 5 values:
  `admin, doctor, radiologist, technician, patient`
  (`supabase/setup/full_setup.sql:96`).
- `hospitals` and `user_profiles.hospital_id` **already exist** in the schema
  (`full_setup.sql:57-89`), and `analysis_sessions.hospital_id` already exists
  (`full_setup.sql:246`) — but hospital scoping is **not consistently enforced**.
  `app/services/permissions.py:_same_hospital()` explicitly treats a missing
  `hospital_id` on either side as "don't block" (single-tenant/dev fallback), and
  most list/query paths don't filter by hospital by default.
- `admin` today behaves like a **super admin**: `can_read_session()` returns `True`
  for `role == "admin"` unconditionally, with no hospital check
  (`app/services/permissions.py:45-46`). There is no role that is scoped to one
  hospital only, and no role with cross-hospital platform authority as a distinct
  concept.
- `technician` is a first-class role wired through the full stack: DB CHECK
  constraint, `analysis_sessions.technician_id` FK, the EEG creation matrix in
  `permissions.py`, `/technician/dashboard` route + `TechnicianDashboard`-style
  logic in shared components, and role-branching in reports, tests, and API
  schemas (32 references across 15 files under `platform/`, plus the seed script
  and both SQL setup files).
- A `super_admin` value already **leaks into the frontend type system** — it's
  present in `UserRole` (`lib/withAuth.tsx:8`) and `UserProfile['role']`
  (`AuthProvider.tsx:23`), and a stub route exists at
  `src/app/super-admin/dashboard/page.tsx` with a
  `components/dashboards/SuperAdminDashboard` — but there is **no backend support
  at all**: not in the DB CHECK constraint, not in `permissions.py`, not in
  `Principal`/JWT role handling, not in `deps.get_current_user`. It is a UI-only
  placeholder today.
- Backend authorization is centralized in `app/services/permissions.py` (good —
  this is the single choke point to extend) and enforced via
  `app/api/deps.get_current_user`, which loads the profile once per request and
  attaches `role`/`hospital_id`/`status` onto the `Principal`
  (`app/api/deps.py:25-61`, `app/core/security.py:29-46`).
- Frontend authorization is duplicated in two places: `withAuth()` HOC and
  `useRequireAuth()` (`lib/withAuth.tsx`), both driven by a hardcoded
  `allowedRoles` array per page and a `role`-string route convention
  (`/${role}/dashboard`).

### 1.2 Proposed architecture

```
                              ┌────────────────┐
                              │   super_admin    │  ← platform-wide, no hospital_id
                              │  (cross-tenant)  │     (hospital_id is NULL, enforced
                              └────────┬─────────┘     by CHECK constraint)
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
   ┌────▼─────┐                  ┌─────▼────┐                   ┌─────▼────┐
   │Hospital A│                  │Hospital B│                   │Hospital N│
   │hospital_id=A                │hospital_id=B                 │hospital_id=N
   ├──────────┤                  ├──────────┤                   ├──────────┤
   │hospital_ │                  │hospital_ │                   │hospital_ │
   │admin     │  ← was "admin"   │admin     │                   │admin     │
   │doctor    │                  │doctor    │                   │doctor    │
   │radiologist│                 │radiologist│                  │radiologist│
   │patient   │                  │patient   │                   │patient   │
   └──────────┘                  └──────────┘                   └──────────┘

   technician role: REMOVED (not migrated forward)
```

The core architectural shift: **tenancy becomes a first-class, enforced concept**
rather than an optional column. Every row that carries clinical or user data must
resolve to exactly one hospital, except rows owned by `super_admin`, which by
definition have no hospital scope.

---

## 2. Role Hierarchy Diagram

```
super_admin                                    (platform-wide, hospital_id = NULL)
   │
   └── manages hospitals[] ──────────────────────────────────────────┐
                                                                       │
hospital_admin  (was "admin")                  (hospital_id = X)     │
   │  scope: hospital X only                                         │
   ├── creates/manages doctor (hospital_id = X)                      │
   ├── creates/manages radiologist (hospital_id = X)                 │
   ├── creates/manages patient (hospital_id = X)                     │
   ├── assigns doctor ↔ patient (within hospital X)                  │
   └── views reports/analytics scoped to hospital X                  │
                                                                       │
doctor          (hospital_id = X, scope: own hospital + assigned pts)│
radiologist     (hospital_id = X, scope: own hospital)                │
patient         (hospital_id = X, scope: own data only)               │
                                                                       │
super_admin can read/write across all of the above ───────────────────┘
```

Role rename map:

| Old role      | New role         | Notes                                   |
|---------------|------------------|------------------------------------------|
| `admin`       | `hospital_admin` | Same person type, scope now bounded to 1 hospital |
| —             | `super_admin`    | New, platform-wide, no hospital binding |
| `doctor`      | `doctor`         | Unchanged, hospital-scoped               |
| `radiologist` | `radiologist`    | Unchanged, hospital-scoped               |
| `technician`  | *(removed)*      | Deleted, not migrated forward            |
| `patient`     | `patient`        | Unchanged, hospital-scoped, self-only    |

---

## 3. Permission Matrix

| Capability                              | super_admin | hospital_admin | doctor | radiologist | patient |
|------------------------------------------|:---:|:---:|:---:|:---:|:---:|
| Create hospital                          | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update/activate/deactivate hospital      | ✅ | own profile fields only | ❌ | ❌ | ❌ |
| Delete hospital (soft)                   | ✅ | ❌ | ❌ | ❌ | ❌ |
| View all hospitals                       | ✅ | own only | ❌ | ❌ | ❌ |
| Create hospital_admin                    | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create doctor / radiologist / patient    | ✅ (any hospital) | ✅ (own hospital) | ❌ | ❌ | ❌ |
| Create additional super_admin            | ✅ (optional, flagged) | ❌ | ❌ | ❌ | ❌ |
| View users                                | all | own hospital | own hospital (read) | own hospital (read) | self |
| View analysis sessions                   | all | own hospital | assigned patients | own hospital's sessions | own only |
| View reports                              | all | own hospital | assigned patients' | own hospital's | own only |
| Cross-hospital analytics                 | ✅ | ❌ | ❌ | ❌ | ❌ |
| Per-hospital analytics                   | ✅ (any) | ✅ (own) | ❌ | ❌ | ❌ |
| Assign doctor ↔ patient                  | ✅ | ✅ (own hospital) | ❌ | ❌ | ❌ |
| Manage platform settings                 | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage hospital profile/settings         | ✅ (any) | ✅ (own) | ❌ | ❌ | ❌ |
| Create EEG/MRI analysis                  | ✅ | ✅ | ✅ | ✅ (both modalities) | ❌ |
| Retry failed session                     | ✅ | ✅ | ✅ (own care team) | ✅ (own care team) | ❌ |

Fail-closed rule carries forward unchanged: unknown/unrecognized roles get nothing
(`permissions.py` docstring, line 15).

---

## 4. Entity-Relationship Changes

### 4.1 Unchanged relationships
- `hospitals 1 ── * user_profiles` (already exists, already FK'd).
- `user_profiles 1 ── 1 {doctor,radiologist,patient,admin}_profiles` (role-detail tables).
- `doctor_patient_relationships` already carries `hospital_id` — no structural
  change needed, only a stricter CHECK/RLS.
- `analysis_sessions` already carries `hospital_id`, `patient_id`, `doctor_id`,
  `radiologist_id`, `uploaded_by`.

### 4.2 New relationships
- `hospitals.created_by` → `user_profiles.id` (nullable; tracks which
  `super_admin` created the hospital — audit trail).
- `user_profiles.hospital_id` becomes **conditionally nullable**: `NOT NULL` for
  every role except `super_admin`, where it must be `NULL`. Enforced by a new
  CHECK constraint (`super_admin` rows can't be tied to one hospital — that's the
  whole point of the role).
- New `platform_settings` table (singleton or key/value) owned exclusively by
  `super_admin`, for "Manage platform settings."
- New `audit_log` table (see §6.4) recording cross-cutting admin actions
  (hospital create/deactivate, user create/role-change), keyed by `actor_id`,
  `actor_role`, `hospital_id` (nullable for super_admin actions), `action`,
  `target_table`, `target_id`, `metadata jsonb`, `created_at`.

### 4.3 Removed relationships
- `analysis_sessions.technician_id → user_profiles.id` — column dropped (data
  migrated into `uploaded_by`/`uploaded_by_role` before drop, see §9.4).
- Any `technician_profiles`-style role-detail table if one exists in a legacy
  migration not present in `full_setup.sql` (none found in `platform/`'s live
  schema; `technician` currently has no dedicated profile table, only the shared
  `user_profiles.role = 'technician'` and the `analysis_sessions.technician_id`
  FK — so removal is lighter than a full profile-table teardown).

---

## 5. Updated Database Schema

### 5.1 Tables requiring modification

| Table | Change |
|---|---|
| `hospitals` | Add `created_by uuid references user_profiles(id)`. No structural change otherwise — it's already the tenant root. |
| `user_profiles` | Widen role CHECK to `('super_admin','hospital_admin','doctor','radiologist','patient')`. Add CHECK: `hospital_id IS NULL WHEN role='super_admin'`, `hospital_id IS NOT NULL` otherwise. Data migration: `admin → hospital_admin`, drop `technician` rows (see §9). |
| `admin_profiles` | Rename to `hospital_admin_profiles` (or keep table name, add comment — see §7 naming decision). Add nothing structurally; `permissions jsonb` default can drop the now-implicit `manage_doctors`/`manage_patients` (always true for hospital_admin) and instead gate super_admin-only capabilities. |
| *(new)* `super_admin_profiles` | Optional thin table for symmetry (`user_id pk`, `notes`, `created_at`) — not strictly required since super_admin needs no clinical/employee fields, but keeps the "every role has a profile table" convention and gives a place for a future 2FA/audit flag. |
| `patient_profiles`, `doctor_profiles`, `radiologist_profiles` | No structural change. |
| `doctor_patient_relationships` | No structural change; RLS/permission logic must additionally verify `doctor.hospital_id == patient.hospital_id` at write time (defense in depth beyond the existing `hospital_id` column on the join row). |
| `analysis_sessions` | Drop `technician_id` column (after data backfill into `uploaded_by`). `hospital_id` becomes `NOT NULL` (currently nullable) once backfilled — this is the tenant boundary for every clinical record. |
| `analysis_results`, `analysis_reports`, `job_events` | No direct column change; they inherit tenancy via `session_id → analysis_sessions.hospital_id`, but RLS/service-layer joins must always traverse that FK when checking hospital scope. |
| *(new)* `platform_settings` | Singleton config table, `super_admin`-only read/write. |
| *(new)* `audit_log` | Append-only, records hospital/user lifecycle + role-changing actions. |

### 5.2 CHECK constraint changes

```sql
-- user_profiles.role
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_admin','hospital_admin','doctor','radiologist','patient'));

-- tenancy invariant: only super_admin may have a NULL hospital_id
alter table public.user_profiles
  add constraint user_profiles_hospital_scope_check
  check (
    (role = 'super_admin' and hospital_id is null)
    or (role <> 'super_admin' and hospital_id is not null)
  );

-- hospitals.status unchanged (already active/inactive/suspended)
```

### 5.3 Foreign key changes

- `analysis_sessions.technician_id` — **dropped** (FK + column). Existing rows'
  `technician_id` value is copied into `uploaded_by` (if `uploaded_by` is null)
  before the drop, with `uploaded_by_role` set to a migration-tagged value (see
  §9.4) so historical attribution isn't silently lost.
- `analysis_sessions.hospital_id` — change from nullable to `NOT NULL` (after a
  backfill pass sets it from `patient_id → patient_profiles → user_profiles →
  hospital_id` for any legacy NULL rows).
- `user_profiles.created_by_admin` — semantics unchanged, but now can point to
  either a `hospital_admin` (same-hospital creation) or a `super_admin`
  (cross-hospital creation); no schema change, just a widened meaning.

### 5.4 RLS changes

Current RLS (`full_setup.sql:214-233`) is deliberately permissive at the DB layer
("any authenticated user can read any row") because authorization is enforced in
the FastAPI service layer, not Postgres. That division of responsibility is sound
and should **not** change wholesale — rewriting 10 tables' RLS to be
tenant-aware in Postgres *in addition to* the app layer is extra surface area for
this phase. Recommended approach:

- Keep `authenticated_can_read` as the baseline (frontend AuthProvider still needs
  self-profile reads via the anon client).
- Add a **belt-and-suspenders** hospital-scoping policy on `user_profiles` and
  `analysis_sessions` specifically (the two highest-sensitivity tables), so a bug
  in the FastAPI layer can't leak cross-hospital data even if RLS is the last
  line of defense:

```sql
create policy "hospital_scoped_read" on public.user_profiles
  for select using (
    auth.uid() = id                                  -- self
    or exists (                                        -- super_admin
      select 1 from public.user_profiles su
      where su.id = auth.uid() and su.role = 'super_admin'
    )
    or hospital_id = (                                 -- same hospital
      select hospital_id from public.user_profiles me where me.id = auth.uid()
    )
  );
```

This is additive (a second, stricter policy alongside the existing one is
combined with `OR` by Postgres RLS by default within the same command) — but
because `analysis_sessions` currently has **no permissive policy at all**
(intentionally fail-closed, backend-only access via service role), leave it as
is; the FastAPI `permissions.py` layer is already the sole gate there and stays
that way.

---

## 6. Folder-Level Impact

```
platform/backend/app/
├── core/
│   ├── security.py          # Principal.role type/comments; dev-bypass default role
│   └── config.py            # possibly new settings (e.g. AUDIT_LOG_ENABLED)
├── api/
│   ├── deps.py               # get_current_user — no logic change, but role values it carries change
│   └── v1/
│       ├── users.py          # /users/me unaffected; NEW: user management endpoints
│       ├── analysis.py        # role checks referencing "admin"/"technician"
│       ├── hospitals.py       # NEW FILE — hospital CRUD (super_admin only)
│       └── admin.py           # NEW FILE — hospital_admin-scoped user mgmt endpoints
├── schemas/
│   ├── analysis.py            # role enums/unions referencing technician
│   └── users.py               # NEW FILE — request/response schemas for user & hospital mgmt
├── services/
│   ├── permissions.py         # CENTRAL — full rewrite of role matrix (see §7.2)
│   ├── database.py            # hospital_id filtering helpers, role-aware queries
│   ├── orchestrator.py        # technician_id references in session creation
│   └── audit.py               # NEW FILE — audit_log writer
├── pipelines/base.py           # role validation for pipeline invocation (technician ref)
├── reports/eeg/base_report.py  # technician attribution in report metadata
└── tests/
    ├── test_permissions.py     # full rewrite
    ├── test_analysis_flow.py   # remove technician fixtures/paths
    └── test_hospitals.py       # NEW FILE
    └── test_list_and_users.py  # role list updates

platform/frontend/src/
├── app/
│   ├── super-admin/dashboard/page.tsx        # wire up for real (currently stub)
│   ├── admin/dashboard/page.tsx              # becomes "Hospital Admin Dashboard" (route can stay /admin or move to /hospital-admin — see §8 decision)
│   ├── technician/                            # DELETE entire directory
│   └── api/admin/create-user/route.ts         # role validation update, remove technician
├── components/
│   ├── dashboards/
│   │   ├── AdminDashboard/                     # → HospitalAdminDashboard (rename)
│   │   ├── SuperAdminDashboard/                # flesh out: hospital mgmt, global user mgmt, platform analytics
│   │   └── (no TechnicianDashboard component currently exists as its own folder — logic is inline in UnifiedDashboard/AnalysisUploadForm)
│   ├── icons/AdminIcon.tsx                     # maybe add SuperAdminIcon / HospitalIcon
│   └── providers/AuthProvider.tsx              # UserProfile['role'] union, dashboard-role routing
├── lib/
│   ├── withAuth.tsx                            # UserRole union — remove technician, keep super_admin (make it real)
│   └── api/
│       ├── users.ts                            # role params/filters
│       ├── stats.ts                            # per-hospital vs platform-wide analytics split
│       └── hospitals.ts                        # NEW FILE — hospital CRUD client
├── features/analysis/
│   ├── components/AnalysisUploadForm.tsx       # remove technician upload path
│   ├── components/UnifiedDashboard.tsx         # remove technician branch
│   └── types.ts                                 # role union types
└── middleware.ts                                # currently a no-op pass-through; candidate for real route-guarding (optional hardening, see §7.3)

supabase/
├── setup/full_setup.sql                         # canonical schema — update in place (idempotent by design)
├── migrations/0003_multi_tenant_roles.sql        # NEW — forward migration
├── migrations/0004_drop_technician.sql           # NEW — forward migration
└── seed/seed.mjs                                 # remove technician seed rows, add super_admin + hospital_admin seed
```

---

## 7. Backend Refactoring Detail

### 7.1 `app/services/permissions.py` — full rewrite

This is the single most important file. New shape:

```python
_CREATE_MATRIX: dict[str, set[str]] = {
    "eeg": {"super_admin", "hospital_admin", "radiologist", "doctor"},
    "mri": {"super_admin", "hospital_admin", "radiologist", "doctor"},
}

def can_create_analysis(role, modality): ...   # unchanged shape, updated set

def _same_hospital(user_hospital, session_hospital) -> bool:
    # No longer "unknown = allow". hospital_id is NOT NULL post-migration,
    # so an unknown/missing value should FAIL CLOSED, not pass.
    if user_hospital is None or session_hospital is None:
        return False
    return str(user_hospital) == str(session_hospital)

def can_read_session(user_id, role, hospital_id, session) -> bool:
    if role == "super_admin":
        return True                       # cross-hospital, unconditional
    if role == "hospital_admin":
        return _same_hospital(hospital_id, session.get("hospital_id"))
    if not _same_hospital(hospital_id, session.get("hospital_id")):
        return False
    # ...existing care-team / patient-self checks, technician_id removed
```

Also: `can_read_report`, `can_retry_session` follow the same shift. New functions
needed for the new capabilities:

```python
def can_manage_hospital(role, actor_hospital_id, target_hospital_id) -> bool
def can_manage_user(role, actor_hospital_id, target_user_hospital_id, target_role) -> bool
def can_view_platform_analytics(role) -> bool
def can_view_hospital_analytics(role, actor_hospital_id, target_hospital_id) -> bool
```

**Important behavior change to flag explicitly:** today `_same_hospital` treats a
missing `hospital_id` as "don't block" — a permissive default appropriate for a
single-tenant dev environment. Post-refactor this must become fail-closed
(missing hospital context = deny), because the entire premise of multi-tenant
isolation depends on `hospital_id` being trustworthy and required. This is a
deliberate, security-relevant behavior change and should be called out in the PR
description, not silently folded in.

### 7.2 New API surface

**Hospital Management** (`app/api/v1/hospitals.py`, `super_admin`-only except reads):
- `POST /v1/hospitals` — create hospital
- `GET /v1/hospitals` — list all (super_admin) / own (hospital_admin, single item)
- `GET /v1/hospitals/{id}` — detail
- `PATCH /v1/hospitals/{id}` — update profile/settings
- `POST /v1/hospitals/{id}/activate` / `POST /v1/hospitals/{id}/deactivate`
- `DELETE /v1/hospitals/{id}` — soft delete (status → a new `archived` state, not
  a hard `DELETE FROM`, to preserve referential integrity with existing users/
  sessions — see §9 rollback considerations)

**Hospital Admin / Global User Management** (`app/api/v1/admin.py`):
- `POST /v1/users` — create user; body includes `role`; `hospital_id` is implicit
  (caller's own, for `hospital_admin`) or explicit (for `super_admin` creating
  into any hospital)
- `GET /v1/users` — list; auto-scoped by caller's role (super_admin: optional
  `?hospital_id=` filter across all; hospital_admin: forced to own hospital)
- `GET /v1/users/{id}`, `PATCH /v1/users/{id}` — same scoping rule
- `POST /v1/users/{id}/suspend` / `.../reactivate`
- `POST /v1/patients/{id}/assign-doctor` — hospital_admin (own hospital) or
  super_admin (any)

**Analytics**:
- `GET /v1/analytics/platform` — super_admin only, cross-hospital aggregates
- `GET /v1/analytics/hospital/{id}` — super_admin (any) / hospital_admin (own only)

**Platform Settings**:
- `GET/PATCH /v1/settings` — super_admin only

### 7.3 Other backend touchpoints

- `app/core/security.py` — no structural change; the dev-bypass principal
  (`Principal(user_id=DEV_PRINCIPAL_ID, role="admin", is_dev=True)`,
  `security.py:108`) must be updated to `role="super_admin"` (dev bypass should
  retain maximal access) or made configurable, since `"admin"` will no longer be
  a valid role value anywhere downstream.
- `app/api/deps.py` — no change needed; it already forwards whatever `role`
  string is in `user_profiles`, so it "just works" once the DB values change.
- `app/schemas/analysis.py`, `app/pipelines/base.py`, `app/api/v1/analysis.py`,
  `app/reports/eeg/base_report.py` — remove `technician` from role
  literals/unions; remove `technician_id` field references; update
  `uploaded_by_role` literal type.
- `app/services/database.py`, `app/services/orchestrator.py` — remove
  `technician_id` write path in session creation; ensure every list/query
  function that returns clinical rows accepts and applies a `hospital_id` filter
  (some already do, per `database.py:109-124`; audit the rest).
- `app/services/audit.py` (new) — thin wrapper called from hospital/user mutation
  endpoints to write `audit_log` rows.

---

## 8. Frontend Refactoring Detail

### 8.1 Routing & naming decision needed

Two options for the hospital-admin route:
1. Keep `/admin/dashboard` as the URL (least disruption, just relabel copy/role
   references internally to "Hospital Admin").
2. Rename the route to `/hospital-admin/dashboard` for symmetry with
   `/super-admin/dashboard` (cleaner long-term, but touches every internal link,
   the `withAuth` redirect convention `` `/${role}/dashboard` ``, and any
   bookmarked/shared URLs).

Recommendation: **Option 2**, specifically because the codebase already derives
dashboard routes mechanically from `role` (`/${userProfile.role}/dashboard` in
both `withAuth.tsx:71` and `:126`) — once the DB role value changes from
`admin` to `hospital_admin`, the route naturally becomes `/hospital-admin/dashboard`
with **zero extra redirect logic**, whereas Option 1 would require a special-case
mapping exception to that convention. This is a decision to confirm with you
before implementation.

### 8.2 File-by-file changes

| File | Change |
|---|---|
| `lib/withAuth.tsx` | `UserRole` union: remove `technician`, keep `super_admin` (already present), rename `admin` → `hospital_admin`. |
| `components/providers/AuthProvider.tsx` | `UserProfile['role']` union same change; `getProfileFromMetadata` unaffected structurally. |
| `app/technician/dashboard/page.tsx` | **Delete file + directory.** |
| `app/admin/dashboard/page.tsx` | Move/rename to `app/hospital-admin/dashboard/page.tsx` (per §8.1 decision); update copy "Admin" → "Hospital Admin". |
| `app/super-admin/dashboard/page.tsx` | Flesh out from stub: hospital list/create/activate, global user table, platform analytics, platform settings. |
| `components/dashboards/AdminDashboard/index.tsx` | Rename to `HospitalAdminDashboard`; scope all data fetches to `userProfile.hospital_id`. |
| `components/dashboards/SuperAdminDashboard/index.tsx` | Build out: hospital management panel, cross-hospital user management, platform analytics, settings panel. |
| `features/analysis/components/AnalysisUploadForm.tsx` | Remove technician-specific upload branch/role check. |
| `features/analysis/components/UnifiedDashboard.tsx` | Remove technician role branch; add hospital-scoping awareness for hospital_admin view vs unrestricted for super_admin. |
| `app/analysis/new/page.tsx` | Remove technician from allowed-role gate. |
| `app/api/admin/create-user/route.ts` | Update role validation list; route param naming (`admin` → `hospital_admin` conceptually, keep as needed for BC — see §9). |
| `lib/api/users.ts`, `lib/api/stats.ts` | Add hospital-scoping params; add hospital-management client functions or split into `lib/api/hospitals.ts` (new file). |
| `components/icons/AdminIcon.tsx` | Optionally add a distinct icon for Super Admin vs Hospital Admin (currently share one icon). |
| `middleware.ts` | Currently a pass-through no-op — out of scope to change functionally in this refactor, but flagged as a pre-existing gap (all route protection is client-side in `withAuth`). Not required for this refactor but worth a follow-up ticket. |

### 8.3 New frontend surface

- Hospital management UI: list, create, edit, activate/deactivate (super_admin
  dashboard).
- Global user directory with hospital filter (super_admin dashboard).
- Platform-wide analytics charts (aggregate across hospitals) vs the existing
  single-hospital analytics view (relabeled for hospital_admin).
- Navigation/sidebar: add "Hospitals" and "Platform Settings" entries visible
  only to `super_admin`; remove any technician nav entries.

---

## 9. Database Migration SQL Plan

Two migrations, applied in order, both idempotent-safe and both appended to
`supabase/migrations/` (numbered after the existing `0002_pipeline_options.sql`),
mirroring the project's existing migration convention. `full_setup.sql` is also
updated in place afterward so a fresh install matches the migrated state.

### 9.1 `0003_multi_tenant_roles.sql` (additive — safe to run anytime)

```sql
-- 1. Widen role CHECK to include super_admin (hospital_admin added in a later
--    step once data is migrated, to avoid a window where old 'admin' rows
--    violate a constraint that doesn't yet accept 'admin').
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_admin','admin','hospital_admin','doctor','radiologist','technician','patient'));
  -- transitional: keeps 'admin' and 'technician' valid during rollout

-- 2. Add hospitals.created_by
alter table public.hospitals add column if not exists created_by uuid references public.user_profiles(id);

-- 3. New platform_settings (singleton)
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.user_profiles(id)
);
insert into public.platform_settings (id) values (true) on conflict do nothing;

-- 4. Audit log
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.user_profiles(id),
  actor_role text,
  hospital_id uuid references public.hospitals(id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_log_hospital on public.audit_log(hospital_id);
create index if not exists idx_audit_log_actor on public.audit_log(actor_id);

alter table public.platform_settings enable row level security;
alter table public.audit_log enable row level security;
-- fail-closed by default (no permissive policy) — backend service role only.
```

### 9.2 Data migration (run once, between the two structural migrations)

```sql
-- Promote the first/designated admin(s) to super_admin explicitly (manual
-- step — you choose which existing admin account(s) become platform super
-- admins; do NOT bulk-promote all admins).
-- update public.user_profiles set role = 'super_admin', hospital_id = null
--   where id in (<explicit list of uuids>);

-- Everyone else with role='admin' becomes hospital_admin, keeping their hospital_id.
update public.user_profiles
  set role = 'hospital_admin'
  where role = 'admin';

-- Technician handling: reassign clinical attribution before dropping the role
-- (see 0004 for the column drop). Decide policy: e.g. convert technician
-- accounts to radiologist, or deactivate them. Default recommendation:
-- deactivate (preserve login history, block further access) rather than
-- silently reassign a role with different capabilities.
update public.user_profiles
  set account_status = 'inactive'
  where role = 'technician';
```

### 9.3 `0004_drop_technician.sql` (destructive — run only after 9.2 confirmed)

```sql
-- Backfill uploaded_by from technician_id where uploaded_by is missing,
-- so historical attribution survives the column drop.
update public.analysis_sessions
  set uploaded_by = technician_id,
      uploaded_by_role = 'technician'
  where uploaded_by is null and technician_id is not null;

-- Backfill hospital_id on any legacy NULL rows via the patient's hospital.
update public.analysis_sessions s
  set hospital_id = up.hospital_id
  from public.patient_profiles pp
  join public.user_profiles up on up.id = pp.user_id
  where s.patient_id = pp.user_id and s.hospital_id is null;

-- Now safe to enforce NOT NULL.
alter table public.analysis_sessions alter column hospital_id set not null;

-- Drop the technician FK + column.
alter table public.analysis_sessions drop column if exists technician_id;

-- Tighten role CHECK to the final 5-role set.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_admin','hospital_admin','doctor','radiologist','patient'));

-- Enforce the tenancy invariant.
alter table public.user_profiles drop constraint if exists user_profiles_hospital_scope_check;
alter table public.user_profiles
  add constraint user_profiles_hospital_scope_check
  check (
    (role = 'super_admin' and hospital_id is null)
    or (role <> 'super_admin' and hospital_id is not null)
  );
```

### 9.4 Backward compatibility considerations

- Splitting into two migrations (additive, then destructive) lets backend and
  frontend deploys land **between** them without a hard outage: the transitional
  CHECK in 9.1 still accepts `admin`/`technician` values while new code is being
  rolled out, so a half-deployed state doesn't 500 on writes.
- `technician_id` is preserved as data (copied into `uploaded_by` +
  `uploaded_by_role='technician'`) before being dropped — it is not silently
  destroyed, only the live write-path and role support are removed.
- Any external integration or report template keying off `role='admin'` or
  `role='technician'` string literals must be inventoried before 9.3 runs (this
  is the main hidden risk — see §11).

---

## 10. Multi-Tenant Data Flow

```
Login (Supabase Auth)
        │
        ▼
JWT verified → Principal{user_id, role:null, hospital_id:null}     (core/security.py)
        │
        ▼
get_current_user() loads user_profiles row → Principal{role, hospital_id, status}
        │
        ▼
Route handler calls permissions.can_*(role, hospital_id, ...) before every read/write
        │
        ├─ role == super_admin  → bypass hospital filter, full access
        ├─ role == hospital_admin → hospital_id required to match on every query
        ├─ role == doctor/radiologist → hospital match + care-team/ownership match
        └─ role == patient → self-only, hospital match implicit via own profile
        │
        ▼
DatabaseService queries always include `.eq("hospital_id", ...)` except for super_admin
        │
        ▼
Response serialized — no cross-hospital leakage even if the client requests it
```

Key principle: **hospital_id is injected server-side from the authenticated
principal, never trusted from client input**, except for `super_admin` explicitly
choosing a target hospital (e.g., "create this doctor in Hospital B"), which is
itself an audited action.

---

## 11. Implementation Roadmap

| Phase | Work | Depends on |
|---|---|---|
| 1 | DB migration `0003` (additive, non-breaking) + `platform_settings`/`audit_log` tables | — |
| 2 | Backend: rewrite `permissions.py`, add `hospitals.py`/`admin.py` API routes, add `services/audit.py` | Phase 1 |
| 3 | Data migration: promote chosen super_admin(s), bulk `admin→hospital_admin`, deactivate `technician` accounts | Phase 1, coordinated with stakeholders on who becomes super_admin |
| 4 | Backend: remove `technician` from schemas/pipelines/reports; update dev-bypass principal role | Phase 3 |
| 5 | DB migration `0004` (destructive: drop `technician_id`, tighten CHECKs) | Phases 2–4 deployed and verified |
| 6 | Frontend: role unions, delete technician routes/components, rename Admin→Hospital Admin dashboard | Phase 4 (backend role strings must match) |
| 7 | Frontend: build out Super Admin dashboard (hospital mgmt, global users, platform analytics, settings) | Phase 2 (APIs must exist) |
| 8 | Test suite rewrite (`test_permissions.py`, `test_analysis_flow.py`, new `test_hospitals.py`) | Phases 2–6 |
| 9 | Seed script (`supabase/seed/seed.mjs`) update: seed 1 super_admin + N hospitals with their own hospital_admin/doctor/radiologist/patient sets | Phase 5 |
| 10 | `full_setup.sql` updated in place to reflect final schema for fresh installs | Phase 5 |

---

## 12. Migration Plan (deployment & rollback)

1. **Database migration** — apply `0003` first (additive, zero downtime).
2. **Backend migration** — deploy new `permissions.py`/routes behind the
   transitional CHECK (still accepts `admin`/`technician`), so old and new role
   values both work during rollout. Backend deploy can happen with `admin`/
   `technician` rows still present.
3. **Data migration** — run the `admin → hospital_admin` bulk update and
   super_admin promotion during a low-traffic window (it's a single UPDATE,
   sub-second at expected table sizes, but do it outside peak hours out of
   caution since it changes access for every admin session in flight).
4. **Frontend migration** — deploy once backend is emitting/accepting the new
   role strings; frontend role unions and routes updated together (they're
   already coupled via the `/${role}/dashboard` convention, so this must be a
   single deploy, not split).
5. **Technician deactivation** — after confirming no active technician sessions
   depend on continued access (business decision on notice period).
6. **Destructive DB migration (`0004`)** — run only after backend/frontend are
   both fully on the new role set and technician accounts are deactivated.
7. **Deployment strategy** — rolling deploy is safe for phases 2–4 because the
   transitional CHECK constraint means both role vocabularies are valid
   simultaneously; only step 6 is a point of no return.
8. **Rollback strategy**:
   - Phases 1–4 (additive): rollback = redeploy previous backend/frontend
     versions; the transitional CHECK still accepts old role strings, so no data
     rollback is needed.
   - Phase 5 (data migration): reversible via `update user_profiles set role =
     'admin' where role = 'hospital_admin'` (role name only changed, no data
     loss) as long as `0004` hasn't run yet.
   - Phase 6 (`0004`, destructive): **not cleanly reversible** — `technician_id`
     column and technician CHECK support are gone. Rollback here means restoring
     from a pre-migration backup/snapshot, not a forward SQL script. This is why
     `0004` is gated as the last, deliberate step, run only after a burn-in
     period on `0003` + data migration with no issues.

---

## 13. Risks and Mitigation

| Risk | Mitigation |
|---|---|
| Fail-closed `_same_hospital()` change breaks any code path currently relying on the permissive "unknown hospital = allow" default | Audit all callers of `can_read_session`/`can_read_report` before flipping; add a temporary logging/metrics point on denials during rollout to catch unexpected blocks before they become tickets |
| `technician` accounts lose access mid-migration | Deactivate (not delete) accounts first; give advance notice per hospital; keep historical `analysis_sessions` attribution via `uploaded_by` backfill |
| Someone hardcodes `role === 'admin'` string comparisons outside the files this analysis found (e.g. in legacy `Alzheimer-Detection/` or `mri-platform/` if they're still deployed anywhere) | Explicit repo-wide grep sweep for `'admin'`/`"admin"`/`technician` string literals as a dedicated pre-flight step in Phase 4, not assumed complete from this analysis alone |
| Route rename `/admin` → `/hospital-admin` breaks bookmarks/external links | Add a redirect from the old path if this matters for your users; confirm with you before committing to the rename (§8.1) |
| Cross-hospital data leakage during the transitional window where both old and new role values coexist | Keep the transitional CHECK narrow in time (days, not weeks); the additive migration doesn't loosen any existing isolation, it only adds new valid values |
| `super_admin` promotion is a highly privileged, hard-to-audit action if done via raw SQL | Log the promotion in `audit_log` manually as part of the migration runbook, even though it's a one-off manual UPDATE, not an API call |
| RLS policies added as defense-in-depth could conflict with existing anon-client reads in `AuthProvider` | New `hospital_scoped_read` policy is additive (OR'd with existing `authenticated_can_read`), so it can only widen, never narrow, access — verify this with a staging test before enabling |

---

## 14. Final Summary

The database already has the two things a real multi-tenant model needs most —
a `hospitals` table and `hospital_id` foreign keys on `user_profiles` and
`analysis_sessions` — but neither is currently *enforced* as an isolation
boundary, and there is no role above "sees everything" (`admin`) and no role
strictly bounded to one hospital. This refactor:

1. Splits today's `admin` into `super_admin` (platform-wide, no hospital
   binding) and `hospital_admin` (bounded to exactly one hospital, enforced by a
   new CHECK constraint).
2. Removes `technician` entirely — DB constraint, `analysis_sessions.technician_id`
   column, backend role matrices/schemas, and all frontend routes/components —
   after backfilling historical attribution into `uploaded_by`.
3. Makes `hospital_id` a required, non-null tenancy key everywhere it matters,
   and flips the permission layer's default from "unknown hospital = allow" to
   "unknown hospital = deny."
4. Adds the missing API surface for hospital lifecycle management, cross-hospital
   user management, and platform vs. per-hospital analytics — all gated through
   the same central `permissions.py` choke point the codebase already uses well.
5. Ships as two migrations (additive, then destructive) specifically so backend
   and frontend can roll out independently without a hard cutover, with the
   destructive step gated behind a burn-in period and an explicit rollback plan.

This document is analysis and planning only — **no code or migrations have been
applied**. Next step, on your confirmation, is to work through the roadmap in
§11 phase by phase, starting with the additive DB migration and the
`permissions.py` rewrite.
