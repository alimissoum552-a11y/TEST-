-- Weekly growth e-mail (docs/GROWTH.md). Run after deploying growth-report with --no-verify-jwt.
select cron.unschedule('growth-report') where exists (select 1 from cron.job where jobname = 'growth-report');
select cron.schedule('growth-report', '0 7 * * 1', $$
  select net.http_post(
    url     := 'https://oybvllumenwbzekgxjtz.supabase.co/functions/v1/growth-report',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body    := '{}'::jsonb)
$$);
