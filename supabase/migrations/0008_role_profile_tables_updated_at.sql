-- db.upsert_role_profile() unconditionally includes `updated_at` in every
-- role-profile upsert, but doctor_profiles, hospital_admin_profiles, and
-- super_admin_profiles never had that column — Supabase's `.upsert()`
-- rejects the whole statement when any column is unknown, so every save to
-- these three role tables has been failing outright (full_name/phone/
-- avatar_url still saved fine since those go through the separate
-- user_profiles update). patient_profiles and radiologist_profiles already
-- had updated_at and were unaffected by this specific bug.
alter table public.doctor_profiles add column if not exists updated_at timestamptz not null default now();
alter table public.hospital_admin_profiles add column if not exists updated_at timestamptz not null default now();
alter table public.super_admin_profiles add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_doctor_profiles_updated_at on public.doctor_profiles;
create trigger trg_doctor_profiles_updated_at before update on public.doctor_profiles
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_hospital_admin_profiles_updated_at on public.hospital_admin_profiles;
create trigger trg_hospital_admin_profiles_updated_at before update on public.hospital_admin_profiles
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_super_admin_profiles_updated_at on public.super_admin_profiles;
create trigger trg_super_admin_profiles_updated_at before update on public.super_admin_profiles
  for each row execute function public.update_updated_at_column();
