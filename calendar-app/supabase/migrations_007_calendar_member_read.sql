-- Fix: members could read events of a shared calendar but not the calendar row,
-- so the client never discovered shared calendars and never loaded their events.
-- Owners keep full control through the existing "calendars_own" policy.
drop policy if exists "calendars_member_read" on public.calendars;
create policy "calendars_member_read" on public.calendars for select
  using (public.calendar_role(id, auth.uid()) is not null);
