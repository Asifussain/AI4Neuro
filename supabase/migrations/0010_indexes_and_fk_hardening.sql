-- Missing indexes on the columns every RLS policy and directory/list query
-- filters on, plus a missing FK on patient_profiles.assigned_doctor_id.
--
-- Note: assigned_doctor_id is not currently written by any code path in
-- platform/backend (the real doctor<->patient link is
-- doctor_patient_relationships; see app/api/v1/users.py) — the FK is added
-- anyway as a safety net for its declared purpose, consistent with keeping
-- schema constraints correct even for a column not yet in active use.

create index if not exists idx_user_profiles_hospital_id on public.user_profiles(hospital_id);
create index if not exists idx_user_profiles_role on public.user_profiles(role);
create index if not exists idx_user_profiles_account_status on public.user_profiles(account_status);

-- Supports ORDER BY created_at DESC pagination on the audit log (see the
-- DB-side pagination work landing alongside this migration).
create index if not exists idx_audit_log_created_at on public.audit_log(created_at);

alter table public.patient_profiles drop constraint if exists patient_profiles_assigned_doctor_id_fkey;
alter table public.patient_profiles
  add constraint patient_profiles_assigned_doctor_id_fkey
  foreign key (assigned_doctor_id) references public.user_profiles(id);
