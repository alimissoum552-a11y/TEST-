-- Daily purge of minor profiles still pending after 30 days (docs/FAMILY_TEAM.md, section 14.4).
-- Run AFTER migrations_016_family_team.sql has been applied.

create extension if not exists pg_cron;

select cron.unschedule('family-purge-pending')
  where exists (select 1 from cron.job where jobname = 'family-purge-pending');

select cron.schedule(
  'family-purge-pending',
  '40 3 * * *',
  $$ select public.purge_stale_pending_profiles() $$
);
