-- AI assistant: consent, shared availability, and per-user usage counting.

-- 1. Consent: the date the user accepted the assistant policy. Empty = no AI access.
alter table public.profiles add column if not exists ai_accepted_at timestamptz;

-- 2. Busy times only (no titles, no descriptions) for any calendar the caller can access.
-- Used by the assistant to read availability of shared calendars without seeing event content.
create or replace function public.calendar_busy(cal uuid, win_start timestamptz, win_end timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.starts_at, e.ends_at
  from events e
  where e.calendar_id = cal
    and public.calendar_role(cal, auth.uid()) is not null
    and e.starts_at < win_end
    and e.ends_at > win_start
  order by e.starts_at
$$;
revoke all on function public.calendar_busy(uuid, timestamptz, timestamptz) from public;
grant execute on function public.calendar_busy(uuid, timestamptz, timestamptz) to authenticated;

-- 3. Usage log: one row per assistant request. Written by the Edge Function (service role) only.
-- No prompt or answer text is stored. Used later to set prices from real costs.
create table if not exists public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  tool_calls    integer not null default 0
);
create index if not exists ai_usage_user_time_idx on public.ai_usage(user_id, created_at);

alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage_own_read" on public.ai_usage;
create policy "ai_usage_own_read" on public.ai_usage for select
  using (user_id = auth.uid());
