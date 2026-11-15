-- Calendar App schema. Extensible: add tables without breaking existing ones.

create extension if not exists "pgcrypto";

-- Profiles mirror auth.users (one row per authenticated user).
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique,
  display_name text,
  avatar_url  text,
  timezone    text not null default 'Europe/Paris',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Calendars: a user can own several calendars (personal, work, ...).
create table if not exists public.calendars (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null default 'Mon calendrier',
  color_tone  text not null default 'neutral-900',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists calendars_owner_idx on public.calendars(owner_id);

-- Events.
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  calendar_id   uuid not null references public.calendars(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  description   text,
  location      text,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  all_day       boolean not null default false,
  color_tone    text not null default 'neutral-600',
  repeat_rule   text,                      -- e.g. RRULE string, reserved for later
  reminder_minutes int default 10,
  metadata      jsonb not null default '{}'::jsonb,  -- extension point
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint events_time_order check (ends_at >= starts_at)
);
create index if not exists events_owner_starts_idx on public.events(owner_id, starts_at);
create index if not exists events_calendar_idx on public.events(calendar_id);

-- Keep updated_at fresh.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();
drop trigger if exists calendars_touch on public.calendars;
create trigger calendars_touch before update on public.calendars
for each row execute function public.touch_updated_at();
drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
for each row execute function public.touch_updated_at();

-- Create profile + default calendar when a user signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.calendars (owner_id, name, is_default)
  values (new.id, 'Mon calendrier', true);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Row Level Security: each user only sees and edits their own data.
alter table public.profiles  enable row level security;
alter table public.calendars enable row level security;
alter table public.events    enable row level security;

drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "calendars_own" on public.calendars;
create policy "calendars_own" on public.calendars for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "events_own" on public.events;
create policy "events_own" on public.events for all
  using (auth.uid() = owner_id) with check (
    auth.uid() = owner_id and exists (
      select 1 from public.calendars c where c.id = calendar_id and c.owner_id = auth.uid()
    )
  );
