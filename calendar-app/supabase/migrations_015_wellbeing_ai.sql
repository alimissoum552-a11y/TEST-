-- Well-being AI: private alerts for a member, and a log of team analyses (owner can read it).
-- Written only by the server (service role). Nothing is written from the browser.

-- 1. Private alerts. Only the person concerned can read them. The group is never told who.
create table if not exists public.wellbeing_alerts (
  id           bigint generated always as identity primary key,
  calendar_id  uuid not null references public.calendars(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('crisis')),
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index if not exists wellbeing_alerts_user_idx on public.wellbeing_alerts (user_id, created_at desc);

alter table public.wellbeing_alerts enable row level security;
drop policy if exists "wellbeing_alerts_own_read" on public.wellbeing_alerts;
create policy "wellbeing_alerts_own_read" on public.wellbeing_alerts for select
  using (user_id = auth.uid());
drop policy if exists "wellbeing_alerts_own_mark_read" on public.wellbeing_alerts;
create policy "wellbeing_alerts_own_mark_read" on public.wellbeing_alerts for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. Journal of each team analysis run. Kept 90 days by the cron job (see wellbeing_cron.sql).
-- Only the calendar owner can read it. It stores counts and sources, never message text.
create table if not exists public.wellbeing_analysis_log (
  id              bigint generated always as identity primary key,
  calendar_id     uuid not null references public.calendars(id) on delete cascade,
  ran_at          timestamptz not null default now(),
  sources         text not null,
  messages_read   integer not null default 0,
  load_days       integer not null default 0,
  crisis_alerts   integer not null default 0,
  posted          boolean not null default false
);
create index if not exists wellbeing_analysis_log_idx on public.wellbeing_analysis_log (calendar_id, ran_at desc);

alter table public.wellbeing_analysis_log enable row level security;
drop policy if exists "wellbeing_log_owner_read" on public.wellbeing_analysis_log;
create policy "wellbeing_log_owner_read" on public.wellbeing_analysis_log for select
  using (exists (select 1 from public.calendars c where c.id = calendar_id and c.owner_id = auth.uid()));
