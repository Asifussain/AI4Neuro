-- =====================================================================
-- Multi-tenant role refactor, part 2 (destructive — run only after 0003 has
-- been deployed, the backend/frontend are fully cut over to the new role
-- names, and technician accounts have had their access window close).
--
-- This is NOT cleanly reversible: it drops analysis_sessions.technician_id
-- and tightens the role CHECK to the final 5-role set. Take a backup/snapshot
-- before running in production.
-- =====================================================================

-- 0. Promote your platform's Super Admin(s) BEFORE running this migration.
--    Do this explicitly, per account — never bulk-promote every hospital_admin.
--    Example (uncomment and fill in real ids):
-- update public.user_profiles set role = 'super_admin', hospital_id = null
--   where id in ('00000000-0000-0000-0000-000000000000');

-- 1. Backfill uploaded_by/uploaded_by_role from technician_id so historical
--    attribution survives the column drop.
update public.analysis_sessions
  set uploaded_by = technician_id,
      uploaded_by_role = 'technician'
  where uploaded_by is null and technician_id is not null;

-- 2. Backfill hospital_id on any legacy NULL rows via the patient's hospital.
update public.analysis_sessions s
  set hospital_id = up.hospital_id
  from public.patient_profiles pp
  join public.user_profiles up on up.id = pp.user_id
  where s.patient_id = pp.user_id and s.hospital_id is null;

-- 3. hospital_id is now a required tenancy key on every analysis session.
alter table public.analysis_sessions alter column hospital_id set not null;

-- 4. Drop the technician FK + column.
alter table public.analysis_sessions drop column if exists technician_id;

-- 5. Remove technician accounts (already deactivated in 0003). Their historical
--    analysis_sessions attribution is preserved via uploaded_by/uploaded_by_role
--    above, so this is safe once you've confirmed no downstream report/export
--    still needs a live technician user_profiles row.
delete from public.user_profiles where role = 'technician';

-- 6. Tighten the role CHECK to the final 5-role set.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_admin','hospital_admin','doctor','radiologist','patient'));

-- 7. Tenancy invariant: only super_admin may have a NULL hospital_id.
alter table public.user_profiles drop constraint if exists user_profiles_hospital_scope_check;
alter table public.user_profiles
  add constraint user_profiles_hospital_scope_check
  check (
    (role = 'super_admin' and hospital_id is null)
    or (role <> 'super_admin' and hospital_id is not null)
  );

-- 8. Real tenant-isolation RLS: REPLACE the blanket "any authenticated user"
--    read policy with a hospital-scoped one on every identity table (RLS
--    policies on the same table are OR'd, so a permissive policy left in
--    place alongside a strict one would defeat the strict one entirely — the
--    strict policy must be the ONLY select policy remaining).
create or replace function public.is_super_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function public.my_hospital_id()
returns uuid language sql stable as $$
  select hospital_id from public.user_profiles where id = auth.uid();
$$;

drop policy if exists "authenticated_can_read" on public.hospitals;
drop policy if exists "hospital_scoped_read" on public.hospitals;
create policy "hospital_scoped_read" on public.hospitals
  for select using (public.is_super_admin() or id = public.my_hospital_id());

drop policy if exists "authenticated_can_read" on public.user_profiles;
drop policy if exists "hospital_scoped_read" on public.user_profiles;
create policy "hospital_scoped_read" on public.user_profiles
  for select using (
    auth.uid() = id
    or public.is_super_admin()
    or hospital_id = public.my_hospital_id()
  );

do $$
declare t text;
begin
  foreach t in array array[
    'patient_profiles','doctor_profiles','radiologist_profiles','hospital_admin_profiles'
  ]
  loop
    execute format('drop policy if exists "authenticated_can_read" on public.%I', t);
    execute format('drop policy if exists "hospital_scoped_read" on public.%I', t);
    execute format(
      'create policy "hospital_scoped_read" on public.%I for select using ('
      || 'auth.uid() = user_id'
      || ' or public.is_super_admin()'
      || ' or exists ('
      || '   select 1 from public.user_profiles up'
      || '   where up.id = %I.user_id and up.hospital_id = public.my_hospital_id()'
      || ' )'
      || ')', t, t
    );
  end loop;
end $$;

drop policy if exists "authenticated_can_read" on public.super_admin_profiles;
drop policy if exists "hospital_scoped_read" on public.super_admin_profiles;
create policy "hospital_scoped_read" on public.super_admin_profiles
  for select using (auth.uid() = user_id or public.is_super_admin());

drop policy if exists "authenticated_can_read" on public.doctor_patient_relationships;
drop policy if exists "hospital_scoped_read" on public.doctor_patient_relationships;
create policy "hospital_scoped_read" on public.doctor_patient_relationships
  for select using (public.is_super_admin() or hospital_id = public.my_hospital_id());
