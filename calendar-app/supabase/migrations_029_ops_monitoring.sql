-- 029: operations monitoring (docs/OPERATIONS.md, "Monitoring").
-- ops_errors: unexpected errors of the Edge functions and of the web app (scrubbed: no e-mail address, no token).
-- ops_state: small key/value memory of the alert job (last run, site down since...).
-- Only the service role reads or writes them (RLS on, no policy).
create table if not exists public.ops_errors (
  id bigserial primary key,
  at timestamptz not null default now(),
  source text not null,
  code text,
  message text,
  detail jsonb not null default '{}'::jsonb,
  alerted_at timestamptz
);
create index if not exists ops_errors_at_idx on public.ops_errors (at);
create index if not exists ops_errors_unalerted_idx on public.ops_errors (alerted_at) where alerted_at is null;
alter table public.ops_errors enable row level security;

create table if not exists public.ops_state (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.ops_state enable row level security;

-- Scheduled jobs that failed since a given time (pg_cron keeps the run history in its own schema).
create or replace function public.ops_cron_failures(p_since timestamptz)
returns table (jobname text, failures bigint, last_message text)
language sql security definer set search_path = public, cron as $$
  select j.jobname, count(*), max(left(d.return_message, 300))
  from cron.job_run_details d join cron.job j on j.jobid = d.jobid
  where d.status = 'failed' and d.start_time >= p_since
  group by j.jobname
$$;
revoke execute on function public.ops_cron_failures(timestamptz) from public, anon, authenticated;
grant execute on function public.ops_cron_failures(timestamptz) to service_role;
