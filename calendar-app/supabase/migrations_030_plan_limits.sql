-- 030: limits of each plan, enforced in the database (docs/PRICING.md, "The grid").
-- * Shared calendars (any calendar except the personal one): plans.max_shared_calendars (null = unlimited).
-- * Members of a calendar (members and pending invitations, minors included): none on a plan without shared
--   calendars (free, starter), at most plans.max_members_per_calendar otherwise (null = unlimited).
-- * Team well-being analysis: only on plans with plans.team_wellbeing (team_work, launch).
-- The plan is the owner's. A canceled subscription counts as the free plan. Existing calendars, members and settings
-- are never removed by a limit: a limit only stops adding more.

alter table public.plans add column if not exists team_wellbeing boolean not null default false;
update public.plans set team_wellbeing = true where code in ('team_work', 'launch');

create or replace function public.plan_of(p_user uuid)
returns public.plans language sql stable security definer set search_path = public as $$
  select p.* from public.plans p
  where p.code = coalesce(
    (select case when s.status = 'canceled' then 'free' else s.plan_code end from public.subscriptions s where s.user_id = p_user),
    public.default_plan())
$$;
revoke execute on function public.plan_of(uuid) from public, anon, authenticated;
grant execute on function public.plan_of(uuid) to service_role;

create or replace function public.enforce_plan_calendars()
returns trigger language plpgsql security definer set search_path = public as $$
declare pl public.plans; n integer;
begin
  if new.is_default then return new; end if;
  pl := public.plan_of(new.owner_id);
  if pl.max_shared_calendars is null then return new; end if;
  select count(*) into n from public.calendars where owner_id = new.owner_id and not is_default;
  if n >= pl.max_shared_calendars then
    raise exception 'plan_limit_calendars' using hint = pl.code;
  end if;
  return new;
end $$;

-- Members already in the calendar plus invitations still pending.
create or replace function public.calendar_seats_used(p_calendar uuid)
returns integer language sql stable security definer set search_path = public as $$
  select (select count(*) from public.calendar_members where calendar_id = p_calendar)::integer
       + (select count(*) from public.calendar_invites i where i.calendar_id = p_calendar and i.status = 'pending'
            and not exists (select 1 from public.calendar_members m where m.calendar_id = p_calendar and m.user_id = i.invitee_id))::integer
$$;

create or replace function public.check_plan_members(p_calendar uuid, p_extra integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; pl public.plans;
begin
  select owner_id into v_owner from public.calendars where id = p_calendar;
  if v_owner is null then return; end if;
  pl := public.plan_of(v_owner);
  if pl.max_shared_calendars = 0 then
    raise exception 'plan_limit_members' using hint = pl.code;
  end if;
  if pl.max_members_per_calendar is not null and public.calendar_seats_used(p_calendar) + p_extra > pl.max_members_per_calendar then
    raise exception 'plan_limit_members' using hint = pl.code;
  end if;
end $$;

create or replace function public.enforce_plan_members()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.calendars where id = new.calendar_id;
  if new.user_id = v_owner then return new; end if;
  -- Already a member (a role change through "on conflict do update"): not a new seat.
  if exists (select 1 from public.calendar_members where calendar_id = new.calendar_id and user_id = new.user_id) then return new; end if;
  -- Accepting a pending invitation uses the seat the invitation already held.
  if exists (select 1 from public.calendar_invites where calendar_id = new.calendar_id and invitee_id = new.user_id and status = 'pending') then
    perform public.check_plan_members(new.calendar_id, 0);
  else
    perform public.check_plan_members(new.calendar_id, 1);
  end if;
  return new;
end $$;

create or replace function public.enforce_plan_invites()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Sending the same invitation again does not take another seat.
  if exists (select 1 from public.calendar_invites where calendar_id = new.calendar_id and lower(invitee_email) = lower(new.invitee_email)) then return new; end if;
  perform public.check_plan_members(new.calendar_id, 1);
  return new;
end $$;

create or replace function public.enforce_plan_team_wellbeing()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if not coalesce(new.enabled, false) then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.enabled, false) then return new; end if;
  select owner_id into v_owner from public.calendars where id = new.calendar_id;
  if not (public.plan_of(v_owner)).team_wellbeing then
    raise exception 'plan_limit_team_wellbeing';
  end if;
  return new;
end $$;

-- The analysis job skips calendars whose owner's plan no longer includes it.
create or replace function public.team_wellbeing_allowed(p_calendar uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((public.plan_of(c.owner_id)).team_wellbeing, false) from public.calendars c where c.id = p_calendar
$$;

do $$
declare f text;
begin
  foreach f in array array['enforce_plan_calendars()', 'calendar_seats_used(uuid)', 'check_plan_members(uuid,integer)',
    'enforce_plan_members()', 'enforce_plan_invites()', 'enforce_plan_team_wellbeing()', 'team_wellbeing_allowed(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.team_wellbeing_allowed(uuid) to service_role;

drop trigger if exists calendars_plan_limit on public.calendars;
create trigger calendars_plan_limit before insert on public.calendars for each row execute function public.enforce_plan_calendars();
drop trigger if exists calendar_members_plan_limit on public.calendar_members;
create trigger calendar_members_plan_limit before insert on public.calendar_members for each row execute function public.enforce_plan_members();
drop trigger if exists calendar_invites_plan_limit on public.calendar_invites;
create trigger calendar_invites_plan_limit before insert on public.calendar_invites for each row execute function public.enforce_plan_invites();
drop trigger if exists team_wellbeing_plan_limit on public.team_wellbeing;
create trigger team_wellbeing_plan_limit before insert or update on public.team_wellbeing for each row execute function public.enforce_plan_team_wellbeing();
