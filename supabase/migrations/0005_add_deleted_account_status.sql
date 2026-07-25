-- =====================================================================
-- Add a terminal "deleted" account_status, distinct from "suspended".
--
-- suspended = temporary/reversible (an admin can reactivate).
-- deleted   = terminal soft-delete; the account is hidden from directory
--             listings and can never be reactivated. Rows are kept (not
--             hard-deleted) to preserve referential integrity with existing
--             analysis_sessions / doctor_patient_relationships history.
-- =====================================================================

alter table public.user_profiles drop constraint if exists user_profiles_account_status_check;
alter table public.user_profiles
  add constraint user_profiles_account_status_check
  check (account_status in ('pending','active','suspended','inactive','deleted'));
