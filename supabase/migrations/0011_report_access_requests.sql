-- =====================================================================
-- Patient -> assigned-doctor report-access requests.
--
-- A patient must request access to their own analysis reports from their
-- assigned doctor; the report only opens once the doctor approves. One row per
-- patient tracks their current access state (pending / approved / denied).
--
-- Idempotent and safe to re-run.
-- =====================================================================

create table if not exists public.report_access_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.user_profiles(id) on delete cascade,
  doctor_id uuid references public.user_profiles(id) on delete set null,
  hospital_id uuid references public.hospitals(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','approved','denied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  -- One current access record per patient (re-requesting updates it in place).
  unique (patient_id)
);
create index if not exists idx_rar_doctor on public.report_access_requests(doctor_id);
create index if not exists idx_rar_status on public.report_access_requests(status);

alter table public.report_access_requests enable row level security;
-- Reads/writes go through the backend (service role); fail-closed for anon.

notify pgrst, 'reload schema';
