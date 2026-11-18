-- 035: day-by-day numbers for a running campaign (docs/GROWTH.md). Same rules as growth_report(): adults only,
-- launch-plan test accounts left out, counts only (no name, no address).
create or replace function public.growth_daily(p_days integer default 14)
returns jsonb language sql stable security definer set search_path = public, auth as $$
with days as (
  select generate_series(date_trunc('day', now()) - make_interval(days => least(greatest(p_days, 1), 90) - 1), date_trunc('day', now()), interval '1 day') as day
),
people as (
  select p.id, p.created_at from public.profiles p join public.subscriptions s on s.user_id = p.id
  where p.account_type = 'adult' and s.plan_code <> 'launch'
)
select coalesce(jsonb_agg(jsonb_build_object(
  'day', to_char(d.day, 'YYYY-MM-DD'),
  'signups', (select count(*) from people pe where pe.created_at >= d.day and pe.created_at < d.day + interval '1 day'),
  'shared_calendars_created', (select count(*) from public.calendars c join people pe on pe.id = c.owner_id
      where not c.is_default and c.created_at >= d.day and c.created_at < d.day + interval '1 day'),
  'invitations_sent', (select count(*) from public.calendar_invites i join people pe on pe.id = i.invited_by
      where i.created_at >= d.day and i.created_at < d.day + interval '1 day'),
  'events_created', (select count(*) from public.events e join people pe on pe.id = e.owner_id
      where e.created_at >= d.day and e.created_at < d.day + interval '1 day'),
  'new_paid_subscriptions', (select count(*) from public.subscriptions s join people pe on pe.id = s.user_id
      where s.source = 'stripe' and s.started_at >= d.day and s.started_at < d.day + interval '1 day')
) order by d.day), '[]'::jsonb)
from days d
$$;
revoke execute on function public.growth_daily(integer) from public, anon, authenticated;
grant execute on function public.growth_daily(integer) to service_role;
