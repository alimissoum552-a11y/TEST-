-- Hourly team well-being analysis, and 90-day retention of its log. Run in the Supabase SQL editor AFTER:
--   1. migrations_015_wellbeing_ai.sql has been applied;
--   2. the function is deployed:  supabase functions deploy wellbeing-team --no-verify-jwt
--   3. the secret CRON_SECRET is already set (same value as the reminders job, stored in Vault).
--
-- Nothing here contains a secret: the job reads CRON_SECRET from Vault at run time.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('wellbeing-team')
  where exists (select 1 from cron.job where jobname = 'wellbeing-team');

select cron.schedule(
  'wellbeing-team',
  '17 * * * *',
  $$
  select net.http_post(
    url     := 'https://oybvllumenwbzekgxjtz.supabase.co/functions/v1/wellbeing-team',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

select cron.unschedule('wellbeing-log-retention')
  where exists (select 1 from cron.job where jobname = 'wellbeing-log-retention');

select cron.schedule(
  'wellbeing-log-retention',
  '30 3 * * *',
  $$ delete from public.wellbeing_analysis_log where ran_at < now() - interval '90 days' $$
);
