-- =====================================================================
-- Realign the hospital-admin role VALUE to `admin` (idempotent, safe to
-- re-run).
--
-- Migrations 0003/0004 renamed the hospital-admin role value from `admin`
-- to `hospital_admin` in the database, but the entire application layer
-- (frontend `ROLES`, backend `Role.hospital_admin.value == "admin"`, and the
-- seed script) writes and reads the value `admin`. That divergence broke the
-- whole user-creation flow:
--
--   * Creating a Hospital Admin failed: the backend inserts `role = 'admin'`,
--     which the tightened CHECK constraint (0004) rejected because it only
--     allowed `hospital_admin`.
--   * An existing Hospital Admin (whose row 0003 had renamed to
--     `hospital_admin`) was denied every action: the backend RBAC compares
--     against `role == 'admin'`, so a `hospital_admin` row matched no branch.
--
-- The application value `admin` is the intended canonical wire/DB value (it is
-- documented as such in app/schemas/users.py and frontend/src/lib/roles.ts,
-- kept for backward-compatibility with existing JWTs/rows). This migration
-- makes the database agree with the application again.
--
-- NOTE: `hospital_admin` here is only the ROLE VALUE. The role-detail TABLE is
-- still named `hospital_admin_profiles` and is intentionally left unchanged.
-- =====================================================================

-- 1a. Rename any rows that 0003 migrated to `hospital_admin` back to `admin`.
update public.user_profiles set role = 'admin' where role = 'hospital_admin';

-- 1b. Remove any leftover `technician` accounts. The multi-tenant refactor
--     removed the technician role entirely (see 0004_drop_technician.sql); on a
--     database where 0004 was never run, these rows survive and would violate
--     the tightened 5-role CHECK below. Their analysis attribution is preserved
--     via analysis_sessions.uploaded_by_role (a text label, kept), while every
--     foreign-key link to the row is cleared first so the delete cannot fail on
--     a RESTRICT constraint. Idempotent: a no-op once no technician remains.
do $$
declare tech_id uuid;
begin
  for tech_id in select id from public.user_profiles where role = 'technician'
  loop
    update public.analysis_sessions set uploaded_by = null where uploaded_by = tech_id;
    update public.analysis_sessions set doctor_id = null where doctor_id = tech_id;
    update public.analysis_sessions set radiologist_id = null where radiologist_id = tech_id;
    update public.doctor_patient_relationships set assigned_by = null where assigned_by = tech_id;
    update public.user_profiles set created_by_admin = null where created_by_admin = tech_id;
    update public.hospitals set created_by = null where created_by = tech_id;
    update public.audit_log set actor_id = null where actor_id = tech_id;
    update public.platform_settings set updated_by = null where updated_by = tech_id;
    delete from public.user_profiles where id = tech_id;
  end loop;
end $$;

-- 2. Canonical 5-role CHECK using `admin` as the hospital-admin value.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_admin','admin','doctor','radiologist','patient'));

-- 3. Ensure the hospital audit column exists (the source of the
--    "Could not find the 'created_by' column of 'hospitals' in the schema
--    cache" error when 0003 had not been applied). Idempotent.
alter table public.hospitals
  add column if not exists created_by uuid references public.user_profiles(id);

-- 4. Force PostgREST (the Supabase REST/schema-cache layer) to reload its
--    schema cache so newly added columns like hospitals.created_by become
--    immediately visible to the API without waiting for the periodic reload.
notify pgrst, 'reload schema';
