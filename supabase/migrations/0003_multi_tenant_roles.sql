-- =====================================================================
-- Multi-tenant role refactor, part 1 (additive, safe to run anytime).
--
-- Introduces `super_admin` (platform-wide) and `hospital_admin` (was `admin`,
-- now explicitly scoped to one hospital). Widens the role CHECK to accept both
-- old and new role values so this can be deployed ahead of the app-layer
-- rollout without breaking in-flight writes. Run 0004 (destructive) only after
-- the app is fully cut over and technician accounts have been deactivated.
-- =====================================================================

-- 1. Transitional role CHECK: accepts old + new role names simultaneously.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_admin','admin','hospital_admin','doctor','radiologist','technician','patient'));

-- 2. Hospital lifecycle audit field.
alter table public.hospitals add column if not exists created_by uuid references public.user_profiles(id);

-- 3. Platform settings (Super Admin only, singleton row).
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.user_profiles(id)
);
insert into public.platform_settings (id) values (true) on conflict do nothing;

-- 4. Audit log for hospital/user lifecycle actions.
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
-- Fail-closed by default (no permissive policy) — backend service role only.

-- 5. Data migration: `admin` -> `hospital_admin` (role rename only, no data loss).
update public.user_profiles set role = 'hospital_admin' where role = 'admin';

-- 6. Technician accounts: deactivate rather than delete, to preserve login
--    history while blocking further access. Historical analysis_sessions
--    attribution is backfilled in 0004 before the technician_id column drops.
update public.user_profiles set account_status = 'inactive' where role = 'technician';

-- 7. Optional symmetry table for the new role (no clinical/employee fields
--    required, but keeps the "every role has a profile table" convention and
--    gives a home for future per-super-admin settings, e.g. 2FA flags).
create table if not exists public.super_admin_profiles (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.super_admin_profiles enable row level security;
drop policy if exists "authenticated_can_read" on public.super_admin_profiles;
create policy "authenticated_can_read" on public.super_admin_profiles
  for select using (auth.uid() is not null);

-- 8. Rename admin_profiles -> hospital_admin_profiles to match the renamed role.
alter table if exists public.admin_profiles rename to hospital_admin_profiles;
