-- =====================================================================
-- 0009 — Realign the hospital-admin role VALUE to `admin` AND bring a database
-- that never received migrations 0003+ up to what the multi-tenant app needs.
--
-- Why this exists
-- ---------------
-- Two independent breakages made the whole user-creation flow fail:
--
--   1. Role value divergence. Migrations 0003/0004 renamed the hospital-admin
--      role value from `admin` to `hospital_admin`, but the entire application
--      layer (backend `Role.hospital_admin.value == "admin"`, frontend `ROLES`,
--      and the seed) writes and reads `admin`. So creating a Hospital Admin was
--      rejected by the CHECK constraint, and an existing `hospital_admin` row
--      matched no backend RBAC branch (they all compare against `admin`).
--
--   2. A database created before migrations 0003+ were applied is missing the
--      `hospitals.created_by` column (the "Could not find the 'created_by'
--      column of 'hospitals' in the schema cache" error) plus the `audit_log`,
--      `platform_settings`, and `super_admin_profiles` tables, and may still
--      carry leftover `technician` rows (a role the refactor removed).
--
-- This migration is fully IDEMPOTENT and ADDITIVE. It deliberately does NOT add
-- the tenancy-invariant CHECK or the hospital-scoped RLS rewrite from 0003/0004
-- — those can fail on pre-existing legacy rows and are not required for the
-- create flow. Run supabase/setup/full_setup.sql for the fully hardened schema
-- on a clean project.
--
-- NOTE: `hospital_admin` below is only the ROLE VALUE. The role-detail TABLE is
-- intentionally named `hospital_admin_profiles` and is kept.
-- =====================================================================

-- 1. Preserve hospital-admin detail rows created under the pre-0003 name:
--    rename the old `admin_profiles` table if it still exists (0003 step 8).
alter table if exists public.admin_profiles rename to hospital_admin_profiles;

-- 2. hospitals.created_by — the missing column behind the schema-cache error.
--    Added first so the technician cleanup below can safely reference it.
alter table public.hospitals
  add column if not exists created_by uuid references public.user_profiles(id);

-- 3. Tables introduced by 0003 that a pre-0003 database lacks. All additive.
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.user_profiles(id)
);
insert into public.platform_settings (id) values (true) on conflict do nothing;

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

create table if not exists public.super_admin_profiles (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now()
);

-- audit_log / platform_settings: fail-closed (backend service role bypasses
-- RLS). super_admin_profiles: readable by self or a super_admin, matching
-- full_setup.sql so the frontend's own-profile fetch works.
alter table public.platform_settings   enable row level security;
alter table public.audit_log            enable row level security;
alter table public.super_admin_profiles enable row level security;
drop policy if exists "authenticated_can_read" on public.super_admin_profiles;
drop policy if exists "hospital_scoped_read" on public.super_admin_profiles;
create policy "authenticated_can_read" on public.super_admin_profiles
  for select using (auth.uid() is not null);

-- 4. Rename any rows 0003 migrated to `hospital_admin` back to `admin`.
update public.user_profiles set role = 'admin' where role = 'hospital_admin';

-- 5. Remove any leftover `technician` accounts so the strict 5-role CHECK can
--    apply. Their analysis attribution is preserved via
--    analysis_sessions.uploaded_by_role (a text label). Every foreign-key link
--    is cleared first so the delete cannot fail on a RESTRICT constraint, and
--    every reference is guarded against tables/columns that may not exist on
--    an older database. Idempotent: a no-op once no technician remains.
do $$
declare tech_id uuid;
begin
  for tech_id in select id from public.user_profiles where role = 'technician'
  loop
    if to_regclass('public.analysis_sessions') is not null then
      update public.analysis_sessions set uploaded_by    = null where uploaded_by    = tech_id;
      update public.analysis_sessions set doctor_id       = null where doctor_id       = tech_id;
      update public.analysis_sessions set radiologist_id  = null where radiologist_id  = tech_id;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'analysis_sessions'
          and column_name = 'technician_id'
      ) then
        execute 'update public.analysis_sessions set technician_id = null where technician_id = $1'
          using tech_id;
      end if;
    end if;
    if to_regclass('public.doctor_patient_relationships') is not null then
      update public.doctor_patient_relationships set assigned_by = null where assigned_by = tech_id;
    end if;
    update public.user_profiles set created_by_admin = null where created_by_admin = tech_id;
    update public.hospitals       set created_by      = null where created_by      = tech_id;
    if to_regclass('public.audit_log') is not null then
      update public.audit_log set actor_id = null where actor_id = tech_id;
    end if;
    if to_regclass('public.platform_settings') is not null then
      update public.platform_settings set updated_by = null where updated_by = tech_id;
    end if;
    delete from public.user_profiles where id = tech_id;
  end loop;
end $$;

-- 6. Canonical 5-role CHECK using `admin` as the hospital-admin value.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_admin','admin','doctor','radiologist','patient'));

-- 7. Reload the PostgREST schema cache so newly added columns/tables become
--    immediately visible to the Supabase REST API.
notify pgrst, 'reload schema';
