-- =====================================================================
-- 0002_pipeline_options.sql
-- Adds a modality-agnostic options bag to analysis_sessions.
--
-- Carries per-analysis pipeline inputs that don't warrant dedicated columns:
--   EEG: {"channel_index": 3}          (similarity-plot channel)
--   MRI: {"scan_metadata": {...}}      (scanner/sequence metadata)
--
-- ADDITIVE and IDEMPOTENT.
-- =====================================================================

alter table public.analysis_sessions
  add column if not exists pipeline_options jsonb not null default '{}'::jsonb;
