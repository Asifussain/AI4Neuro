-- Reverts the *stored role value* introduced by 0003/0004 from
-- 'hospital_admin' back to 'admin'.
--
-- 0003/0004 renamed the hospital-scoped admin role's stored value to
-- 'hospital_admin' and tightened the CHECK constraint to require it. But the
-- application layer was never updated to match: both
-- `platform/backend/app/schemas/users.py` (`Role.hospital_admin = "admin"`,
-- with an explicit NOTE documenting this as intentional) and
-- `platform/frontend/src/lib/roles.ts` (`ROLES = [..., 'admin', ...]`, same
-- NOTE) already use the literal string 'admin' as the wire/DB value
-- everywhere, on purpose. 'hospital_admin' is only ever a *display label* or
-- a *table name* (`hospital_admin_profiles`) — never a role-column value —
-- in the app code. This migration converges the database to match the app
-- layer that was already built, rather than the other way around, since
-- rewriting ~15 already-shipped frontend files and the permission layer
-- would be a much larger, riskier change for the same end state.
--
-- Idempotent and safe to run on any DB state: a fresh install that never ran
-- 0003/0004's rename, and a DB that did run them, both converge to the same
-- result.

-- 1. Data migration first, while the CHECK still accepts 'hospital_admin'.
update public.user_profiles set role = 'admin' where role = 'hospital_admin';

-- 2. Tighten the CHECK back to the app layer's 5-role set.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_admin','admin','doctor','radiologist','patient'));

-- 3. The tenancy invariant from 0004 is role-name-agnostic (super_admin vs.
--    everyone else) and needs no change — re-asserted here only for
--    idempotency/safety in case a future migration ever drops it.
alter table public.user_profiles drop constraint if exists user_profiles_hospital_scope_check;
alter table public.user_profiles
  add constraint user_profiles_hospital_scope_check
  check (
    (role = 'super_admin' and hospital_id is null)
    or (role <> 'super_admin' and hospital_id is not null)
  );

-- Note: `hospital_admin_profiles` (the TABLE name) is intentionally left
-- unchanged — it's orthogonal to the role *value* reverted above.
