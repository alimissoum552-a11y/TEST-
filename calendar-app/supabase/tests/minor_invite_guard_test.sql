-- Regression test for migration 036: a minor account cannot accept a general calendar invitation.
--
-- Disposable database only. Creates its own users and calendar, then rolls back.
-- Run with: psql -v ON_ERROR_STOP=1 -f tests/minor_invite_guard_test.sql
-- Every check raises an exception on failure, so a non-zero exit means the guard regressed.

begin;

-- ---------- fixtures ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test', '{"account_type":"adult","display_name":"Owner"}'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test', '{"account_type":"adult","display_name":"Other"}'),
  ('33333333-3333-3333-3333-333333333333', 'minor@example.test', '{"account_type":"minor","display_name":"Minor"}');

do $$
declare
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  owner_cal uuid;
  minor_inv uuid;
  adult_inv uuid;
begin
  if (select account_type from public.profiles where id = '33333333-3333-3333-3333-333333333333') <> 'minor' then
    raise exception 'fixture: minor profile not marked as minor';
  end if;

  select id into owner_cal from public.calendars where owner_id = v_owner and is_default order by created_at limit 1;
  if owner_cal is null then raise exception 'fixture: adult has no default calendar'; end if;

  -- Same shape as invite_to_calendar in production: invitee_id is set when the invite is created.
  insert into public.calendar_invites(calendar_id, invitee_email, invitee_id, role, invited_by)
  values (owner_cal, 'minor@example.test', '33333333-3333-3333-3333-333333333333', 'reader', v_owner) returning id into minor_inv;
  insert into public.calendar_invites(calendar_id, invitee_email, invitee_id, role, invited_by)
  values (owner_cal, 'other@example.test', '22222222-2222-2222-2222-222222222222', 'contributor', v_owner) returning id into adult_inv;

  perform set_config('test.minor_inv', minor_inv::text, true);
  perform set_config('test.adult_inv', adult_inv::text, true);
  perform set_config('test.owner_cal', owner_cal::text, true);
end $$;

-- Calls accept_invite as a given user inside the authenticated role and returns the SQLSTATE
-- (null when the call succeeded). Empty uid means "signed in but no subject" (auth.uid() is null).
create function pg_temp.try_accept(inv uuid, uid uuid) returns text
language plpgsql as $$
declare
  code text := null;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  set local role authenticated;
  begin
    perform public.accept_invite(inv);
  exception when others then
    code := sqlstate;
  end;
  reset role;
  return code;
end $$;

-- ---------- Test A: minor rejected ----------
do $$
declare code text;
begin
  code := pg_temp.try_accept(current_setting('test.minor_inv')::uuid, '33333333-3333-3333-3333-333333333333');
  if code is distinct from '42501' then
    raise exception 'FAIL A: minor accept expected SQLSTATE 42501, got %', coalesce(code, 'no error');
  end if;
  raise notice 'PASS A: minor rejected with 42501';
end $$;

-- ---------- Test B: no membership granted ----------
do $$
declare n int;
begin
  select count(*) into n from public.calendar_members
   where user_id = '33333333-3333-3333-3333-333333333333'
     and calendar_id = current_setting('test.owner_cal')::uuid;
  if n <> 0 then raise exception 'FAIL B: minor was added to calendar_members (% rows)', n; end if;
  raise notice 'PASS B: minor has no membership';
end $$;

-- ---------- Test C: invitation untouched ----------
do $$
declare r public.calendar_invites;
begin
  select * into r from public.calendar_invites where id = current_setting('test.minor_inv')::uuid;
  if r.status <> 'pending' then raise exception 'FAIL C: status changed to %', r.status; end if;
  if r.invitee_id is distinct from '33333333-3333-3333-3333-333333333333' then
    raise exception 'FAIL C: invitee_id changed to %', r.invitee_id;
  end if;
  if r.responded_at is not null then raise exception 'FAIL C: responded_at was set to %', r.responded_at; end if;
  raise notice 'PASS C: invitation still pending, invitee_id unchanged, responded_at null';
end $$;

-- ---------- Unauthenticated caller ----------
do $$
declare code text;
begin
  code := pg_temp.try_accept(current_setting('test.minor_inv')::uuid, null);
  if code is distinct from '42501' then
    raise exception 'FAIL unauthenticated: expected 42501, got %', coalesce(code, 'no error');
  end if;
  raise notice 'PASS unauthenticated: rejected with 42501';
end $$;

-- ---------- Wrong e-mail ----------
do $$
declare code text;
begin
  code := pg_temp.try_accept(current_setting('test.minor_inv')::uuid, '22222222-2222-2222-2222-222222222222');
  if code is distinct from '42501' then
    raise exception 'FAIL wrong e-mail: expected 42501, got %', coalesce(code, 'no error');
  end if;
  raise notice 'PASS wrong e-mail: rejected with 42501';
end $$;

-- ---------- Test D: adult acceptance still works ----------
do $$
declare
  code text;
  r public.calendar_invites;
  m public.calendar_members;
begin
  code := pg_temp.try_accept(current_setting('test.adult_inv')::uuid, '22222222-2222-2222-2222-222222222222');
  if code is not null then raise exception 'FAIL D: adult accept failed with %', code; end if;

  select * into r from public.calendar_invites where id = current_setting('test.adult_inv')::uuid;
  if r.status <> 'accepted' then raise exception 'FAIL D: invite status is %', r.status; end if;
  if r.invitee_id <> '22222222-2222-2222-2222-222222222222' then raise exception 'FAIL D: wrong invitee_id'; end if;
  if r.responded_at is null then raise exception 'FAIL D: responded_at not set'; end if;

  select * into m from public.calendar_members
   where user_id = '22222222-2222-2222-2222-222222222222'
     and calendar_id = current_setting('test.owner_cal')::uuid;
  if not found then raise exception 'FAIL D: membership not created'; end if;
  if m.role <> 'contributor' then raise exception 'FAIL D: membership role is %', m.role; end if;
  raise notice 'PASS D: adult accepted, membership contributor, invitation accepted';
end $$;

-- ---------- Already answered ----------
do $$
declare code text;
begin
  code := pg_temp.try_accept(current_setting('test.adult_inv')::uuid, '22222222-2222-2222-2222-222222222222');
  if code is distinct from 'P0001' then
    raise exception 'FAIL already answered: expected P0001, got %', coalesce(code, 'no error');
  end if;
  raise notice 'PASS already answered: rejected';
end $$;

do $$ begin raise notice 'ALL MINOR INVITE GUARD TESTS PASSED'; end $$;

rollback;
