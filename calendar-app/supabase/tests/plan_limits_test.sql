-- Plan limits test (migration 030). Always ends with an exception, so nothing is kept. Every line must say "ok".
do $$
declare
  out text := ''; u_free uuid := gen_random_uuid(); u_pro uuid := gen_random_uuid(); u_launch uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid(); m2 uuid := gen_random_uuid(); m3 uuid := gen_random_uuid();
  c_free uuid; c_pro uuid; c_pro2 uuid; c_launch uuid; ok boolean;
begin
  insert into auth.users(id, email, aud, role) values
    (u_free, 'pl-free@example.com', 'authenticated', 'authenticated'), (u_pro, 'pl-pro@example.com', 'authenticated', 'authenticated'),
    (u_launch, 'pl-launch@example.com', 'authenticated', 'authenticated'), (m1, 'pl-m1@example.com', 'authenticated', 'authenticated'),
    (m2, 'pl-m2@example.com', 'authenticated', 'authenticated'), (m3, 'pl-m3@example.com', 'authenticated', 'authenticated');
  update subscriptions set plan_code = 'pro', source = 'manual' where user_id = u_pro;
  update subscriptions set plan_code = 'launch', source = 'launch' where user_id = u_launch;
  update plans set max_members_per_calendar = 2 where code = 'pro'; -- small limit for the test (rolled back)
  select id into c_free from calendars where owner_id = u_free and is_default;

  begin insert into calendars(owner_id, name) values (u_free, 'x'); out := out || 'free creates a shared calendar: NOT BLOCKED | ';
  exception when others then out := out || format('free creates a shared calendar: %s | ', case when sqlerrm = 'plan_limit_calendars' then 'ok' else sqlerrm end); end;
  begin insert into calendar_members(calendar_id, user_id, role) values (c_free, m1, 'reader'); out := out || 'free adds a member: NOT BLOCKED | ';
  exception when others then out := out || format('free adds a member: %s | ', case when sqlerrm = 'plan_limit_members' then 'ok' else sqlerrm end); end;

  insert into calendars(owner_id, name) values (u_pro, 'Pro team') returning id into c_pro; out := out || 'pro creates 1 shared calendar: ok | ';
  begin insert into calendars(owner_id, name) values (u_pro, 'second') returning id into c_pro2; out := out || 'pro creates a 2nd: NOT BLOCKED | ';
  exception when others then out := out || format('pro creates a 2nd: %s | ', case when sqlerrm = 'plan_limit_calendars' then 'ok' else sqlerrm end); end;
  insert into calendar_members(calendar_id, user_id, role) values (c_pro, m1, 'reader');
  insert into calendar_invites(calendar_id, invitee_email, role, invited_by) values (c_pro, 'pl-m2@example.com', 'reader', u_pro);
  out := out || 'pro: 1 member + 1 invitation within the limit of 2: ok | ';
  begin insert into calendar_invites(calendar_id, invitee_email, role, invited_by) values (c_pro, 'pl-m3@example.com', 'reader', u_pro); out := out || 'pro: 3rd seat by invitation: NOT BLOCKED | ';
  exception when others then out := out || format('pro: 3rd seat by invitation: %s | ', case when sqlerrm = 'plan_limit_members' then 'ok' else sqlerrm end); end;
  begin insert into calendar_members(calendar_id, user_id, role) values (c_pro, m3, 'reader'); out := out || 'pro: 3rd seat direct: NOT BLOCKED | ';
  exception when others then out := out || format('pro: 3rd seat direct: %s | ', case when sqlerrm = 'plan_limit_members' then 'ok' else sqlerrm end); end;
  update calendar_invites set invitee_id = m2 where calendar_id = c_pro and invitee_email = 'pl-m2@example.com';
  insert into calendar_members(calendar_id, user_id, role) values (c_pro, m2, 'reader'); out := out || 'pro: the invited person accepts (seat already held): ok | ';
  insert into calendar_members(calendar_id, user_id, role) values (c_pro, m1, 'contributor') on conflict (calendar_id, user_id) do update set role = excluded.role;
  out := out || 'pro: role change of an existing member: ok | ';

  begin insert into team_wellbeing(calendar_id, enabled) values (c_pro, true); out := out || 'pro turns on team well-being: NOT BLOCKED | ';
  exception when others then out := out || format('pro turns on team well-being: %s | ', case when sqlerrm = 'plan_limit_team_wellbeing' then 'ok' else sqlerrm end); end;

  insert into calendars(owner_id, name) values (u_launch, 'L1') returning id into c_launch;
  insert into calendars(owner_id, name) values (u_launch, 'L2'), (u_launch, 'L3');
  insert into calendar_members(calendar_id, user_id, role) values (c_launch, m1, 'reader'), (c_launch, m2, 'reader'), (c_launch, m3, 'reader');
  insert into team_wellbeing(calendar_id, enabled) values (c_launch, true);
  out := out || 'launch: 3 calendars, 3 members, team well-being: ok | ';
  select public.team_wellbeing_allowed(c_launch) and not public.team_wellbeing_allowed(c_pro) into ok;
  out := out || format('analysis allowed only where the plan has it: %s', case when ok then 'ok' else 'WRONG' end);
  raise exception 'RESULTS: %', out;
end $$;
