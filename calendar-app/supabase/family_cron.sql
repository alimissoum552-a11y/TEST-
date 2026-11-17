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

-- Minor login attempts are only kept for the 15-minute limit window; delete them after one day.
select cron.unschedule('minor-attempts-purge')
  where exists (select 1 from cron.job where jobname = 'minor-attempts-purge');

select cron.schedule(
  'minor-attempts-purge',
  '50 3 * * *',
  $$ delete from public.minor_login_attempts where created_at < now() - interval '1 day' $$
);

-- Invitations of adults responsible that were never used (no account created) are removed after 30 days.
select cron.unschedule('guardian-invites-purge')
  where exists (select 1 from cron.job where jobname = 'guardian-invites-purge');

select cron.schedule(
  'guardian-invites-purge',
  '55 3 * * *',
  $$ delete from public.profile_guardian_invites where created_at < now() - interval '30 days' $$
);
