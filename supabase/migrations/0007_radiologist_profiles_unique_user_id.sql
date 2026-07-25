-- radiologist_profiles is the only role-detail table keyed by its own `id`
-- rather than `user_id` (every other role table uses user_id as the primary
-- key). db.upsert_role_profile() always upserts with `on_conflict="user_id"`,
-- which requires a unique constraint on that column — without one, Postgres
-- rejects the upsert outright with "no unique or exclusion constraint
-- matching the ON CONFLICT specification", so every radiologist profile save
-- has been failing at the database level regardless of which columns it sent.
alter table public.radiologist_profiles
  add constraint radiologist_profiles_user_id_key unique (user_id);
