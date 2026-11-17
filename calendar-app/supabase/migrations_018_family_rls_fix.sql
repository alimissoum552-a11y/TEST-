-- Fix: the row policies of managed_profiles and profile_guardians referenced each other, which made
-- PostgreSQL report "infinite recursion detected in policy". The checks now go through security definer
-- functions, which read the tables without re-entering the policies.

create or replace function public.is_calendar_owner_of_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.managed_profiles m join public.calendars c on c.id = m.calendar_id
    where m.id = p_profile and c.owner_id = auth.uid()
  )
$$;

create or replace function public.is_guardian_of_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profile_guardians g where g.profile_id = p_profile and g.user_id = auth.uid()
  )
$$;

revoke all on function public.is_calendar_owner_of_profile(uuid) from public;
revoke all on function public.is_guardian_of_profile(uuid) from public;
grant execute on function public.is_calendar_owner_of_profile(uuid) to authenticated;
grant execute on function public.is_guardian_of_profile(uuid) to authenticated;

drop policy if exists "managed_read" on public.managed_profiles;
create policy "managed_read" on public.managed_profiles for select using (
  exists (select 1 from public.calendars c where c.id = calendar_id and c.owner_id = auth.uid())
  or public.is_guardian_of_profile(id)
);

drop policy if exists "guardians_read" on public.profile_guardians;
create policy "guardians_read" on public.profile_guardians for select using (
  user_id = auth.uid() or public.is_calendar_owner_of_profile(profile_id)
);

drop policy if exists "guardians_owner_write" on public.profile_guardians;
create policy "guardians_owner_write" on public.profile_guardians for all
  using (public.is_calendar_owner_of_profile(profile_id))
  with check (public.is_calendar_owner_of_profile(profile_id));

drop policy if exists "declarations_read" on public.declarations;
create policy "declarations_read" on public.declarations for select using (
  signer_id = auth.uid() or public.is_calendar_owner_of_profile(profile_id)
);
