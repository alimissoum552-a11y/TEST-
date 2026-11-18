-- Monitoring jobs (docs/OPERATIONS.md, "Monitoring"). Run AFTER migrations_029_ops_monitoring.sql and after deploying
-- ops-alert with --no-verify-jwt. The job reads CRON_SECRET from Vault at run time; nothing here is a secret.
select cron.unschedule('ops-alert') where exists (select 1 from cron.job where jobname = 'ops-alert');
select cron.schedule('ops-alert', '*/15 * * * *', $$
  select net.http_post(
    url     := 'https://oybvllumenwbzekgxjtz.supabase.co/functions/v1/ops-alert',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body    := '{}'::jsonb)
$$);

-- The error journal is kept 90 days.
select cron.unschedule('ops-errors-retention') where exists (select 1 from cron.job where jobname = 'ops-errors-retention');
select cron.schedule('ops-errors-retention', '35 3 * * *', $$ delete from public.ops_errors where at < now() - interval '90 days' $$);
