-- Well-being mode: personal settings and check-ins (owner only), and team settings (set by the calendar owner only).
-- Nothing here is readable by team members, administrators or other users, except the team settings flags.

-- 1. Personal settings: optional profile and permissions, all off by default.
create table if not exists public.wellbeing_settings (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  mode_enabled         boolean not null default false,
  age_band             text check (age_band in ('18-29', '30-44', '45-59', '60+')),
  profession           text check (char_length(profession) <= 60),
  family_status        text check (family_status in ('alone', 'couple', 'family_with_children')),
  checkin_enabled      boolean not null default false,
  mood_in_checkin      boolean not null default false,
  breaks_enabled       boolean not null default false,
  agenda_analysis      boolean not null default false,
  updated_at           timestamptz not null default now()
);

alter table public.wellbeing_settings enable row level security;
drop policy if exists "wellbeing_settings_owner" on public.wellbeing_settings;
create policy "wellbeing_settings_owner" on public.wellbeing_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. Daily check-ins (energy 1-10, optional mood 1-5). Owner only. Kept 12 months.
create table if not exists public.wellbeing_checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  day         date not null,
  energy      smallint not null check (energy between 1 and 10),
  mood        smallint check (mood between 1 and 5),
  created_at  timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists wellbeing_checkins_user_day_idx on public.wellbeing_checkins (user_id, day desc);

alter table public.wellbeing_checkins enable row level security;
drop policy if exists "wellbeing_checkins_owner" on public.wellbeing_checkins;
create policy "wellbeing_checkins_owner" on public.wellbeing_checkins for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Team settings: enabled flag and the sources analysed. Members can read them (to see the notice);
-- only the calendar owner can write them.
create table if not exists public.team_wellbeing (
  calendar_id          uuid primary key references public.calendars(id) on delete cascade,
  enabled              boolean not null default false,
  use_agenda           boolean not null default true,
  use_messages         boolean not null default false,
  meeting_hours_alert  numeric(4,1) not null default 3.0 check (meeting_hours_alert between 1 and 12),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references public.profiles(id) on delete set null
);

alter table public.team_wellbeing enable row level security;
drop policy if exists "team_wellbeing_member_read" on public.team_wellbeing;
create policy "team_wellbeing_member_read" on public.team_wellbeing for select
  using (public.calendar_role(calendar_id, auth.uid()) is not null);
drop policy if exists "team_wellbeing_owner_write" on public.team_wellbeing;
create policy "team_wellbeing_owner_write" on public.team_wellbeing for all
  using (exists (select 1 from public.calendars c where c.id = calendar_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.calendars c where c.id = calendar_id and c.owner_id = auth.uid()));

-- 4. A member can ask to be left out of the team analysis of messages. Stored per calendar; owner or member can read their own row.
create table if not exists public.team_wellbeing_optout (
  calendar_id  uuid not null references public.calendars(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (calendar_id, user_id)
);

alter table public.team_wellbeing_optout enable row level security;
drop policy if exists "optout_own" on public.team_wellbeing_optout;
create policy "optout_own" on public.team_wellbeing_optout for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
