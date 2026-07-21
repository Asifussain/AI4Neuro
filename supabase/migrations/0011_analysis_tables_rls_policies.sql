-- Defense-in-depth SELECT policies on the clinical/analysis tables.
--
-- These four tables have had RLS *enabled* with zero policies since
-- migration 0001 — deliberately fail-closed, since the backend always reads
-- them through the service-role key (which bypasses RLS entirely) and no
-- other code path queries them directly today. There is no live exploit
-- here. This migration is purely proactive: it closes the gap for the day
-- something reads with a user's own JWT instead (a realtime status
-- subscription is the obvious future candidate), reusing the exact
-- is_super_admin()/my_hospital_id() helpers already defined in
-- 0004_drop_technician.sql for the identity tables, rather than inventing a
-- second pattern.
--
-- Zero behavior change for the backend: it is unaffected either way.

drop policy if exists "hospital_scoped_read" on public.analysis_sessions;
create policy "hospital_scoped_read" on public.analysis_sessions
  for select using (public.is_super_admin() or hospital_id = public.my_hospital_id());

-- analysis_results/analysis_reports/job_events have no hospital_id column of
-- their own; they inherit tenancy via session_id -> analysis_sessions.
create or replace function public.session_hospital_id(p_session_id uuid)
returns uuid language sql stable as $$
  select hospital_id from public.analysis_sessions where id = p_session_id;
$$;

do $$
declare t text;
begin
  foreach t in array array['analysis_results', 'analysis_reports', 'job_events']
  loop
    execute format('drop policy if exists "hospital_scoped_read" on public.%I', t);
    execute format(
      'create policy "hospital_scoped_read" on public.%I for select using ('
      || 'public.is_super_admin()'
      || ' or public.session_hospital_id(session_id) = public.my_hospital_id()'
      || ')', t
    );
  end loop;
end $$;
