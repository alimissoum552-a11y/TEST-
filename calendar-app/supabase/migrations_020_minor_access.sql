-- Minor access and team calendars (docs/MINOR_APP.md).
-- 1. Account type and the "minor" role: a minor reads the team calendar and chats, nothing else.
-- 2. A minor cannot read other members' profiles (e-mails) nor edit their own profile or feature settings.
-- 3. AI for calendars with minors: no operator approval, only the signed declaration that covers AI.
-- 4. Access identifier, guardian consent (under 13) and login attempts for the minor access.

-- ---------- 1. Account type ----------
alter table public.profiles add column if not exists account_type text not null default 'adult'
  check (account_type in ('adult', 'minor'));

create or replace function public.is_minor(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.account_type = 'minor' from public.profiles p where p.id = uid), false)
$$;
revoke all on function public.is_minor(uuid) from public;
grant execute on function public.is_minor(uuid) to authenticated, service_role;

-- A minor account gets no default calendar.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_type text := coalesce(new.raw_user_meta_data->>'account_type', 'adult');
begin
  if v_type not in ('adult', 'minor') then v_type := 'adult'; end if;
  insert into public.profiles (id, email, display_name, account_type)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), v_type);
  if v_type = 'adult' then
    insert into public.calendars (owner_id, name, is_default) values (new.id, 'Mon calendrier', true);
  end if;
  return new;
end $$;

-- ---------- 2. Role "minor" ----------
alter table public.calendar_members drop constraint if exists calendar_members_role_check;
alter table public.calendar_members add constraint calendar_members_role_check
  check (role in ('administrator', 'contributor', 'reader', 'minor'));

-- Events: the existing policies already keep minors read-only (writes list owner, administrator, contributor).
-- Chat: a minor can write.
drop policy if exists "messages_writer_insert" on public.messages;
create policy "messages_writer_insert" on public.messages for insert with check (
  user_id = auth.uid()
  and public.calendar_role(calendar_id, auth.uid()) in ('owner', 'administrator', 'contributor', 'minor')
);

-- Co-members can read each other's profile, except for minors (the e-mail column would be exposed).
drop policy if exists "profiles_team_read" on public.profiles;
create policy "profiles_team_read" on public.profiles for select using (
  id = auth.uid()
  or (
    not public.is_minor(auth.uid())
    and (
      exists (
        select 1 from public.calendar_members m
        where m.user_id = public.profiles.id
          and public.calendar_role(m.calendar_id, auth.uid()) is not null
      )
      or exists (
        select 1 from public.calendars c
        where c.owner_id = public.profiles.id
          and public.calendar_role(c.id, auth.uid()) is not null
      )
    )
  )
);

-- A minor edits nothing in their profile (the name is set by the adult).
drop policy if exists "profiles_minor_no_update" on public.profiles;
create policy "profiles_minor_no_update" on public.profiles as restrictive for update
  using (not public.is_minor(auth.uid()));

-- Feature tables a minor must not use, whatever the interface shows.
do $$
declare t text;
begin
  foreach t in array array[
    'wellbeing_settings', 'wellbeing_checkins', 'ai_permissions', 'webauthn_credentials',
    'team_wellbeing_optout', 'wellbeing_alerts'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "%s_no_minor" on public.%I', t, t);
      execute format(
        'create policy "%s_no_minor" on public.%I as restrictive for all using (not public.is_minor(auth.uid())) with check (not public.is_minor(auth.uid()))',
        t, t);
    end if;
  end loop;
end $$;

-- Names for the chat and the member list, without e-mail addresses.
create or replace function public.team_member_names(p_calendar uuid)
returns table(id uuid, display_name text, handle text, avatar_url text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.handle, p.avatar_url, public.calendar_role(p_calendar, p.id)
  from public.profiles p
  where public.calendar_role(p_calendar, auth.uid()) is not null
    and public.calendar_role(p_calendar, p.id) is not null
$$;
revoke all on function public.team_member_names(uuid) from public;
grant execute on function public.team_member_names(uuid) to authenticated;

-- ---------- 3. AI for calendars with minors ----------
-- Allowed when every active minor is covered by a signed declaration that includes "ai".
-- The adult owner is responsible; no operator approval is needed any more.
create or replace function public.minor_ai_allowed(p_calendar uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.managed_profiles p
    where p.calendar_id = p_calendar and p.status = 'active'
      and not exists (select 1 from public.declarations d where d.profile_id = p.id and 'ai' = any(d.functions))
  )
$$;

-- ---------- 4. Access, consent and login attempts ----------
alter table public.managed_profiles
  add column if not exists access_id_hash text unique,
  add column if not exists auth_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists access_disabled boolean not null default false,
  add column if not exists access_created_at timestamptz,
  add column if not exists guardian_email text check (char_length(guardian_email) <= 254),
  add column if not exists consent_status text not null default 'not_required'
    check (consent_status in ('not_required', 'pending', 'approved', 'expired')),
  add column if not exists consent_requested_at timestamptz,
  add column if not exists consent_approved_at timestamptz;

-- The owner inserts a plain pending profile. Consent and access columns are written by the server only.
drop policy if exists "managed_owner_insert" on public.managed_profiles;
create policy "managed_owner_insert" on public.managed_profiles for insert with check (
  added_by = auth.uid() and status = 'pending'
  and consent_status = 'not_required' and consent_approved_at is null and consent_requested_at is null
  and access_id_hash is null and auth_user_id is null and access_disabled = false and guardian_email is null
  and exists (select 1 from public.calendars c where c.id = calendar_id and c.owner_id = auth.uid() and c.kind in ('family', 'sports', 'class'))
);

create table if not exists public.minor_consents (
  id              bigint generated always as identity primary key,
  profile_id      uuid not null references public.managed_profiles(id) on delete cascade,
  token_hash      text not null unique,
  guardian_email  text not null,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists minor_consents_profile_idx on public.minor_consents (profile_id);
alter table public.minor_consents enable row level security;   -- no policy: server only

create table if not exists public.minor_login_attempts (
  id          bigint generated always as identity primary key,
  key_hash    text not null,
  created_at  timestamptz not null default now()
);
create index if not exists minor_login_attempts_idx on public.minor_login_attempts (key_hash, created_at desc);
alter table public.minor_login_attempts enable row level security;   -- no policy: server only

-- Signing: under 13 (or possibly under 13, since only the birth year is known) needs the guardian's approval first.
create or replace function public.sign_managed_profile(
  p_profile uuid, p_first text, p_last text, p_functions text[], p_version text
) returns public.managed_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.managed_profiles;
  v_calendar public.calendars;
  v_typed text := public.name_key(p_first || ' ' || p_last);
  v_expected text;
  v_is_owner boolean;
  v_verified boolean;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;

  select * into v_profile from public.managed_profiles where id = p_profile for update;
  if not found then raise exception 'profile_not_found' using errcode = 'P0002'; end if;
  if v_profile.status <> 'pending' then raise exception 'profile_not_pending'; end if;

  select * into v_calendar from public.calendars where id = v_profile.calendar_id;
  v_is_owner := v_calendar.owner_id = v_uid;
  if not v_is_owner and not exists (
    select 1 from public.profile_guardians g where g.profile_id = p_profile and g.user_id = v_uid
  ) then
    raise exception 'not_an_adult_responsible' using errcode = '42501';
  end if;

  if extract(year from now())::int - v_profile.birth_year <= 13 and v_profile.consent_status <> 'approved' then
    raise exception 'consent_required' using errcode = '42501';
  end if;

  if v_is_owner then
    select (v.status = 'verified'), public.name_key(v.verified_name) into v_verified, v_expected
    from public.identity_verifications v where v.user_id = v_uid;
    if not coalesce(v_verified, false) then raise exception 'creator_not_verified' using errcode = '42501'; end if;
    if coalesce(v_expected, '') = '' then raise exception 'identity_name_missing' using errcode = '42501'; end if;
  else
    select public.name_key(p.display_name) into v_expected from public.profiles p where p.id = v_uid;
    if coalesce(v_expected, '') = '' then raise exception 'account_name_missing' using errcode = '42501'; end if;
  end if;

  if v_typed = '' or v_typed <> v_expected then
    raise exception 'name_mismatch' using errcode = '22023';
  end if;

  if v_profile.sex is not null and not ('sex' = any(coalesce(p_functions, '{}'))) then
    raise exception 'declaration_missing_sex' using errcode = '22023';
  end if;

  insert into public.declarations (profile_id, signer_id, typed_name, name_matches, text_version, functions)
  values (p_profile, v_uid, trim(p_first) || ' ' || trim(p_last), true, p_version, coalesce(p_functions, '{}'));

  if v_is_owner then
    insert into public.profile_guardians (profile_id, user_id, role) values (p_profile, v_uid, 'manager')
    on conflict do nothing;
  end if;

  update public.managed_profiles set status = 'active', activated_at = now()
  where id = p_profile returning * into v_profile;
  return v_profile;
end $$;

revoke all on function public.sign_managed_profile(uuid, text, text, text[], text) from public;
grant execute on function public.sign_managed_profile(uuid, text, text, text[], text) to authenticated;
