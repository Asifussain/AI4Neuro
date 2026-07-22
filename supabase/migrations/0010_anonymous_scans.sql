-- =====================================================================
-- Anonymous (outsider) scans for Super Admin.
--
-- A Super Admin may run an MRI/EEG analysis on an outsider who has no patient
-- record, no referring doctor, and no hospital ("anonymous"). To store such a
-- session, analysis_sessions.patient_id and analysis_sessions.hospital_id must
-- be allowed to be NULL (they were tightened to NOT NULL in 0004 for the
-- tenant-scoped flow). Reads stay safe: with a NULL hospital_id only a
-- super_admin can see the row (every other role is hospital-scoped), and the
-- FKs still reference patient_profiles / hospitals when a value is present.
--
-- Idempotent and safe to re-run.
-- =====================================================================

alter table public.analysis_sessions alter column patient_id  drop not null;
alter table public.analysis_sessions alter column hospital_id drop not null;

-- Reload the PostgREST schema cache so the relaxed nullability is picked up.
notify pgrst, 'reload schema';
