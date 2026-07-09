-- =====================================================================
-- 0001_unified_analysis.sql
-- Unified Neuro Platform - analysis layer.
--
-- ADDITIVE and IDEMPOTENT. Adds the modality-agnostic analysis tables that
-- replace EEG `predictions` and MRI `mri_sessions`/`mri_predictions`, WITHOUT
-- touching the existing shared identity tables (user_profiles, patient_profiles,
-- doctor_profiles, radiologist_profiles, hospitals, ...).
--
-- IMPORTANT (see migration plan, conflict #3): the architecture doc's §7 schema
-- assumes patient_profiles.id as PK, but the REAL schema uses patient_profiles
-- .user_id as PK and all FKs point there. This migration follows reality:
--   patient_id                      -> patient_profiles(user_id)
--   doctor/radiologist/technician/uploaded_by -> user_profiles(id)
--   hospital_id                     -> hospitals(id)
--
-- Safe to run multiple times. Test on staging before production (doc §14.11).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Role model fix: add 'technician' (present in dashboards + uploaded_by_role
-- but missing from the user_profiles.role CHECK). Widening only.
-- ---------------------------------------------------------------------
alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('admin', 'doctor', 'radiologist', 'technician', 'patient'));

-- ---------------------------------------------------------------------
-- analysis_sessions
-- ---------------------------------------------------------------------
create table if not exists public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  modality text not null check (modality in ('eeg', 'mri')),
  analysis_type text not null,
  patient_id uuid not null references public.patient_profiles(user_id),
  doctor_id uuid references public.user_profiles(id),
  radiologist_id uuid references public.user_profiles(id),
  technician_id uuid references public.user_profiles(id),
  hospital_id uuid references public.hospitals(id),
  uploaded_by uuid references public.user_profiles(id),
  uploaded_by_role text,
  original_filename text not null,
  raw_file_path text,
  raw_file_bucket text,
  status text not null default 'queued',
  current_stage text,
  progress_percent integer not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  error_message text,
  retry_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- analysis_results (1:1 with a session)
-- ---------------------------------------------------------------------
create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  prediction text not null,
  confidence numeric,
  probabilities jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  similarity jsonb not null default '{}'::jsonb,
  consistency jsonb not null default '{}'::jsonb,
  visualizations jsonb not null default '{}'::jsonb,
  model_version text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- analysis_reports (1:1 with a session)
-- ---------------------------------------------------------------------
create table if not exists public.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  patient_pdf_url text,
  clinician_pdf_url text,
  technical_pdf_url text,
  asset_urls jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- job_events (progress timeline / debugging, doc 7.1)
-- ---------------------------------------------------------------------
create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  level text not null default 'info',
  stage text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indexes (doc §9 Phase 2)
-- ---------------------------------------------------------------------
create index if not exists idx_analysis_sessions_patient_id
  on public.analysis_sessions(patient_id);
create index if not exists idx_analysis_sessions_status
  on public.analysis_sessions(status);
create index if not exists idx_analysis_sessions_modality
  on public.analysis_sessions(modality);
create index if not exists idx_analysis_sessions_hospital_id
  on public.analysis_sessions(hospital_id);
create index if not exists idx_analysis_results_session_id
  on public.analysis_results(session_id);
create index if not exists idx_analysis_reports_session_id
  on public.analysis_reports(session_id);
create index if not exists idx_job_events_session_id
  on public.job_events(session_id);

-- Enforce 1 result / 1 report per session.
create unique index if not exists uq_analysis_results_session
  on public.analysis_results(session_id);
create unique index if not exists uq_analysis_reports_session
  on public.analysis_reports(session_id);

-- ---------------------------------------------------------------------
-- updated_at trigger for analysis_sessions
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_analysis_sessions_updated_at on public.analysis_sessions;
create trigger trg_analysis_sessions_updated_at
  before update on public.analysis_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Storage buckets (private by default; medical data, doc §14.5)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('raw-files', 'raw-files', false),
  ('report-assets', 'report-assets', false),
  ('reports', 'reports', false),
  ('viewer-slices', 'viewer-slices', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- RLS: enabled, fail-closed. Backend uses the service role (bypasses RLS);
-- frontend reads sensitive analysis data via the API (doc §7.3 MVP path).
-- Per-role SELECT policies are added in Phase 5.
-- ---------------------------------------------------------------------
alter table public.analysis_sessions enable row level security;
alter table public.analysis_results  enable row level security;
alter table public.analysis_reports  enable row level security;
alter table public.job_events         enable row level security;
