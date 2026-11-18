-- 034: growth numbers read from the app's own data: no cookie, no tracker (docs/GROWTH.md).
-- Counts adults only, and leaves out the accounts still on the launch plan (the founder's test accounts).
-- signups       : accounts created that week
-- activated     : within 7 days, created an event AND shared (owns a calendar with a member or a pending invitation,
--                 or joined someone else's calendar)
-- came back     : did something (event or message) or signed in between day 7 and day 14
create or replace function public.growth_report(p_weeks integer default 8)
returns jsonb language sql stable security definer set search_path = public, auth as $$
with people as (
  select p.id, p.created_at
  from public.profiles p join public.subscriptions s on s.user_id = p.id
  where p.account_type = 'adult' and s.plan_code <> 'launch'
),
flags as (
  select pe.id, pe.created_at, date_trunc('week', pe.created_at) as week,
    exists (select 1 from public.events e where e.owner_id = pe.id and e.created_at < pe.created_at + interval '7 days') as made_event,
    (exists (select 1 from public.calendars c where c.owner_id = pe.id and not c.is_default and (
        exists (select 1 from public.calendar_members m where m.calendar_id = c.id and m.user_id <> pe.id and m.created_at < pe.created_at + interval '7 days')
        or exists (select 1 from public.calendar_invites i where i.calendar_id = c.id and i.created_at < pe.created_at + interval '7 days')))
     or exists (select 1 from public.calendar_members m join public.calendars c on c.id = m.calendar_id
                where m.user_id = pe.id and c.owner_id <> pe.id and m.created_at < pe.created_at + interval '7 days')) as shared,
    (exists (select 1 from public.events e where e.owner_id = pe.id and e.created_at >= pe.created_at + interval '7 days' and e.created_at < pe.created_at + interval '14 days')
     or exists (select 1 from public.messages g where g.user_id = pe.id and g.created_at >= pe.created_at + interval '7 days' and g.created_at < pe.created_at + interval '14 days')
     or exists (select 1 from auth.users u where u.id = pe.id and u.last_sign_in_at >= pe.created_at + interval '7 days' and u.last_sign_in_at < pe.created_at + interval '14 days')) as came_back
  from people pe
  where pe.created_at >= date_trunc('week', now()) - make_interval(weeks => greatest(p_weeks, 1) - 1)
),
weeks as (
  select week, count(*) as signups,
    count(*) filter (where made_event and shared) as activated,
    count(*) filter (where came_back) as came_back,
    count(*) filter (where created_at <= now() - interval '14 days') as old_enough
  from flags group by week
),
active as (
  select count(distinct x.id) as n from (
    select e.owner_id as id from public.events e where e.created_at > now() - interval '7 days'
    union select g.user_id from public.messages g where g.created_at > now() - interval '7 days'
    union select u.id from auth.users u where u.last_sign_in_at > now() - interval '7 days'
  ) x join people pe on pe.id = x.id
),
paying as (
  select s.plan_code, count(*) as n, sum(case when p.price_month_cents > 0 then p.price_month_cents * greatest(s.seats, 1) else 0 end) as month_cents
  from public.subscriptions s join public.plans p on p.code = s.plan_code
  where s.source = 'stripe' and s.status in ('active', 'trialing', 'past_due') group by s.plan_code
)
select jsonb_build_object(
  'generated_at', now(),
  'people', (select count(*) from people),
  'active_7_days', (select n from active),
  'shared_calendars_3_plus', (select count(*) from public.calendars c where not c.is_default
      and 1 + (select count(*) from public.calendar_members m where m.calendar_id = c.id) >= 3
      and c.owner_id in (select id from people)),
  'paying', coalesce((select jsonb_object_agg(plan_code, n) from paying), '{}'::jsonb),
  'monthly_revenue_list_eur', coalesce((select sum(month_cents) from paying), 0) / 100.0,
  'education_approved', (select count(*) from public.education_requests where status = 'approved'),
  'weeks', coalesce((select jsonb_agg(jsonb_build_object('week', to_char(week, 'YYYY-MM-DD'), 'signups', signups, 'activated', activated,
      'came_back', came_back, 'old_enough_for_return', old_enough) order by week) from weeks), '[]'::jsonb)
)
$$;
revoke execute on function public.growth_report(integer) from public, anon, authenticated;
grant execute on function public.growth_report(integer) to service_role;
