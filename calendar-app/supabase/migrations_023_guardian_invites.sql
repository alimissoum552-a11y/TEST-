-- Adding an adult responsible by e-mail now sends them an e-mail, with or without a Collyo account.
-- - find_user_id_by_email(): lets the server (service role only) know whether an account exists for an address.
-- - profile_guardian_invites: an invitation for an address without an account yet.
-- - link_guardian_invites(): when the address is confirmed, the adult is linked to the profile and added to the team
--   calendar as a contributor (so they can see the calendar and the chat). Done once, then the invitation is deleted.

create or replace function public.find_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1
$$;
revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

create table if not exists public.profile_guardian_invites (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.managed_profiles(id) on delete cascade,
  email       text not null check (char_length(email) <= 254),
  invited_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (profile_id, email)
);
create index if not exists profile_guardian_invites_email_idx on public.profile_guardian_invites (email);
alter table public.profile_guardian_invites enable row level security;   -- no policy: server only

create or replace function public.link_guardian_invites(p_user uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email));
begin
  if v_email = '' then return; end if;
  -- Never link a minor account.
  if exists (select 1 from public.profiles where id = p_user and account_type = 'minor') then return; end if;

  insert into public.profile_guardians (profile_id, user_id, role)
  select i.profile_id, p_user, 'guardian' from public.profile_guardian_invites i where i.email = v_email
  on conflict do nothing;

  insert into public.calendar_members (calendar_id, user_id, role)
  select distinct p.calendar_id, p_user, 'contributor'
  from public.profile_guardian_invites i join public.managed_profiles p on p.id = i.profile_id
  where i.email = v_email
    and not exists (select 1 from public.calendars c where c.id = p.calendar_id and c.owner_id = p_user)
  on conflict (calendar_id, user_id) do nothing;

  delete from public.profile_guardian_invites where email = v_email;
end $$;
revoke all on function public.link_guardian_invites(uuid, text) from public, anon, authenticated;
grant execute on function public.link_guardian_invites(uuid, text) to service_role;

-- Link when the address is confirmed: right at creation if already confirmed (accounts created by the server), or later.
-- The insert trigger is named with a "z_" prefix: triggers of one event run in name order, and the profile row must exist first.
create or replace function public.guardian_invites_on_confirm() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and new.email is not null then
    perform public.link_guardian_invites(new.id, new.email);
  end if;
  return new;
end $$;

drop trigger if exists z_guardian_invites_after_insert on auth.users;
create trigger z_guardian_invites_after_insert after insert on auth.users
  for each row when (new.email_confirmed_at is not null) execute function public.guardian_invites_on_confirm();

drop trigger if exists guardian_invites_after_confirm on auth.users;
create trigger guardian_invites_after_confirm after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.guardian_invites_on_confirm();
