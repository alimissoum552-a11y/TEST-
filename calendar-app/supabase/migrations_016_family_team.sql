-- Family, sports team and class modes: calendar kind, identity verification of the creator (Stripe Identity),
-- managed minor profiles that stay pending until an adult responsible signs a declaration.
-- Written from docs/FAMILY_TEAM.md. Not applied to production until approved.

-- 1. Calendar kind. Existing calendars stay "work" (unchanged behaviour).
alter table public.calendars add column if not exists kind text not null default 'work'
  check (kind in ('personal', 'family', 'sports', 'class', 'work'));

-- 2. Identity verification result of an adult (written by the Stripe webhook only).
-- Only the outcome and the verified name are kept, never documents, selfie or date of birth.
create table if not exists public.identity_verifications (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  status            text not null default 'none' check (status in ('none', 'pending', 'verified', 'failed')),
  stripe_session_id text,
  verified_name     text,
  country           text,
  updated_at        timestamptz not null default now()
);
alter table public.identity_verifications enable row level security;
drop policy if exists "identity_own_read" on public.identity_verifications;
create policy "identity_own_read" on public.identity_verifications for select using (user_id = auth.uid());

-- A family, sports or class calendar needs a verified creator.
create or replace function public.require_verified_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'work' and new.kind <> 'personal' then
    if not exists (
      select 1 from public.identity_verifications v
      where v.user_id = new.owner_id and v.status = 'verified'
    ) then
      raise exception 'creator_not_verified' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists calendars_require_verified_creator on public.calendars;
create trigger calendars_require_verified_creator
  before insert or update of kind on public.calendars
  for each row execute function public.require_verified_creator();

-- 3. Managed minor profiles. No login at first. Pending until a declaration is signed.
create table if not exists public.managed_profiles (
  id            uuid primary key default gen_random_uuid(),
  calendar_id   uuid not null references public.calendars(id) on delete cascade,
  first_name    text not null check (char_length(first_name) between 1 and 60),
  birth_year    smallint not null check (birth_year between 1990 and 2100),
  sex           text check (sex in ('female', 'male', 'other')),
  category      text check (char_length(category) <= 40),
  status        text not null default 'pending' check (status in ('pending', 'active', 'removed')),
  added_by      uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  activated_at  timestamptz
);
create index if not exists managed_profiles_calendar_idx on public.managed_profiles (calendar_id, status);

-- Adults who may see and sign for a profile (the calendar owner always can).
create table if not exists public.profile_guardians (
  profile_id  uuid not null references public.managed_profiles(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'guardian' check (role in ('guardian', 'manager')),
  created_at  timestamptz not null default now(),
  primary key (profile_id, user_id)
);

-- Signed declarations. Written only by sign_managed_profile().
create table if not exists public.declarations (
  id            bigint generated always as identity primary key,
  profile_id    uuid not null references public.managed_profiles(id) on delete cascade,
  signer_id     uuid not null references public.profiles(id) on delete cascade,
  typed_name    text not null,
  name_matches  boolean not null,
  text_version  text not null,
  functions     text[] not null default '{}',
  signed_at     timestamptz not null default now()
);

alter table public.managed_profiles enable row level security;
alter table public.profile_guardians enable row level security;
alter table public.declarations enable row level security;

-- Profiles: the owner and the profile's guardians can read. Only the owner of a family/sports/class calendar writes.
drop policy if exists "managed_read" on public.managed_profiles;
create policy "managed_read" on public.managed_profiles for select using (
  exists (select 1 from public.calendars c where c.id = calendar_id and c.owner_id = auth.uid())
  or exists (select 1 from public.profile_guardians g where g.profile_id = id and g.user_id = auth.uid())
);
drop policy if exists "managed_owner_insert" on public.managed_profiles;
create policy "managed_owner_insert" on public.managed_profiles for insert with check (
  added_by = auth.uid() and status = 'pending'
  and exists (select 1 from public.calendars c where c.id = calendar_id and c.owner_id = auth.uid() and c.kind in ('family', 'sports', 'class'))
);
drop policy if exists "managed_owner_delete" on public.managed_profiles;
create policy "managed_owner_delete" on public.managed_profiles for delete using (
  exists (select 1 from public.calendars c where c.id = calendar_id and c.owner_id = auth.uid())
);

drop policy if exists "guardians_read" on public.profile_guardians;
create policy "guardians_read" on public.profile_guardians for select using (
  user_id = auth.uid()
  or exists (select 1 from public.managed_profiles p join public.calendars c on c.id = p.calendar_id
             where p.id = profile_id and c.owner_id = auth.uid())
);
drop policy if exists "guardians_owner_write" on public.profile_guardians;
create policy "guardians_owner_write" on public.profile_guardians for all using (
  exists (select 1 from public.managed_profiles p join public.calendars c on c.id = p.calendar_id
          where p.id = profile_id and c.owner_id = auth.uid())
) with check (
  exists (select 1 from public.managed_profiles p join public.calendars c on c.id = p.calendar_id
          where p.id = profile_id and c.owner_id = auth.uid())
);

drop policy if exists "declarations_read" on public.declarations;
create policy "declarations_read" on public.declarations for select using (
  signer_id = auth.uid()
  or exists (select 1 from public.managed_profiles p join public.calendars c on c.id = p.calendar_id
             where p.id = profile_id and c.owner_id = auth.uid())
);

-- Accent-insensitive comparison is not available without unaccent; compare case- and space-insensitively.
create or replace function public.normalize_name(v text) returns text
language sql immutable as $$
  select lower(regexp_replace(trim(coalesce(v, '')), '\s+', ' ', 'g'))
$$;

-- 4. Signing. The signer types first and last name. The creator must be identity-verified;
-- another adult is compared with the name on their account (no Stripe check for them).
create or replace function public.sign_managed_profile(
  p_profile uuid, p_first text, p_last text, p_functions text[], p_version text
) returns public.managed_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.managed_profiles;
  v_calendar public.calendars;
  v_typed text := public.normalize_name(p_first || ' ' || p_last);
  v_expected text;
  v_is_owner boolean;
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

  if v_is_owner then
    select public.normalize_name(v.verified_name) into v_expected
    from public.identity_verifications v
    where v.user_id = v_uid and v.status = 'verified';
    if v_expected is null then raise exception 'creator_not_verified' using errcode = '42501'; end if;
  else
    select public.normalize_name(p.display_name) into v_expected from public.profiles p where p.id = v_uid;
  end if;

  if v_typed = '' or v_typed <> v_expected then
    raise exception 'name_mismatch' using errcode = '22023';
  end if;

  -- Sex can only be stored when the declaration explicitly covers it.
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

-- 5. Pending profiles that were never signed are removed after 30 days (run by pg_cron, see the cron file).
create or replace function public.purge_stale_pending_profiles() returns integer
language sql security definer set search_path = public as $$
  with gone as (
    delete from public.managed_profiles
    where status = 'pending' and created_at < now() - interval '30 days'
    returning 1
  ) select count(*)::integer from gone
$$;
