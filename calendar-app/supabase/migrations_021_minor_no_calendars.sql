-- Fix found by the end-to-end test on production: a minor account could create a calendar of its own,
-- because the owner policy of "calendars" lets any user insert a row for themselves. A minor must only
-- read the team calendar. Restrictive policies: they apply on top of the existing ones.

drop policy if exists "calendars_no_minor_insert" on public.calendars;
create policy "calendars_no_minor_insert" on public.calendars as restrictive for insert
  with check (not public.is_minor(auth.uid()));

drop policy if exists "calendars_no_minor_update" on public.calendars;
create policy "calendars_no_minor_update" on public.calendars as restrictive for update
  using (not public.is_minor(auth.uid())) with check (not public.is_minor(auth.uid()));

drop policy if exists "calendars_no_minor_delete" on public.calendars;
create policy "calendars_no_minor_delete" on public.calendars as restrictive for delete
  using (not public.is_minor(auth.uid()));

-- Same guard on the tables a minor could otherwise write through an owner-style policy.
do $$
declare t text;
begin
  foreach t in array array['calendar_invites', 'calendar_members', 'ai_usage', 'chat_ai_notes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "%s_no_minor_write" on public.%I', t, t);
      execute format('create policy "%s_no_minor_write" on public.%I as restrictive for insert with check (not public.is_minor(auth.uid()))', t, t);
    end if;
  end loop;
end $$;
