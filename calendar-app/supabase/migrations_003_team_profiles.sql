-- Team panel: members can read profiles of people who share a calendar with them.
-- Owner profile is readable by members, and members' profiles by co-members.
drop policy if exists "profiles_team_read" on public.profiles;
create policy "profiles_team_read" on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from public.calendar_members m
    where m.user_id = public.profiles.id
      and public.calendar_role(m.calendar_id, auth.uid()) is not null
  )
  or exists (
    select 1 from public.calendars c
    where c.owner_id = public.profiles.id
      and public.calendar_role(c.id, auth.uid()) is not null
  )
);
