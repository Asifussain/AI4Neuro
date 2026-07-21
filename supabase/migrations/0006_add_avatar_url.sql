-- Adds the avatar_url column referenced throughout the frontend
-- (profile/page.tsx, AuthProvider.tsx) and backend (UserResponse.avatar_url,
-- UserUpdate.avatar_url, db.update_user_profile's allowed key set) but never
-- actually migrated onto user_profiles — this is why a saved profile picture
-- appeared to work (same-session refresh) but was lost on the next login:
-- every write against this column was silently failing.
alter table public.user_profiles add column if not exists avatar_url text;
