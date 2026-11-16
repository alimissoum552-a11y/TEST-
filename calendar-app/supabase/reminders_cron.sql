-- One-time setup for reminder e-mails. Run in the Supabase SQL editor AFTER:
--   1. migrations_008_reminders.sql has been applied;
--   2. the function is deployed:  supabase functions deploy send-reminders --no-verify-jwt
--   3. the secret CRON_SECRET is set on the function AND stored in Vault with the same value:
--        supabase secrets set CRON_SECRET=<long random string>
--        select vault.create_secret('<the same long random string>', 'cron_secret');
--
-- Nothing here contains the secret itself: the job reads it from Vault at run time.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-reminders')
  where exists (select 1 from cron.job where jobname = 'send-reminders');

select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://oybvllumenwbzekgxjtz.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
