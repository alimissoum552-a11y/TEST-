-- Regression test for migration 038: the passkey second factor is enforced by the database.
-- Disposable database only. Creates its own users, calendars and events, then rolls back.
-- Run with: psql -v ON_ERROR_STOP=1 -f tests/passkey_stepup_test.sql

begin;

-- ---------- fixtures ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'stepup-a@example.test', '{"account_type":"adult","display_name":"A"}'),
  ('b2222222-2222-2222-2222-222222222222', 'stepup-b@example.test', '{"account_type":"adult","display_name":"B"}'),
  ('c3333333-3333-3333-3333-333333333333', 'stepup-c@example.test', '{"account_type":"adult","display_name":"C"}');

-- A and B have a passkey; C has none.
insert into public.webauthn_credentials(user_id, credential_id, public_key, counter) values
  ('a1111111-1111-1111-1111-111111111111', 'cred-a', 'pk-a', 0),
  ('b2222222-2222-2222-2222-222222222222', 'cred-b', 'pk-b', 0);

-- One event per user, in their own calendar.
do $$
declare u uuid; cal uuid;
begin
  foreach u in array array['a1111111-1111-1111-1111-111111111111'::uuid,
                           'b2222222-2222-2222-2222-222222222222'::uuid,
                           'c3333333-3333-3333-3333-333333333333'::uuid] loop
    select id into cal from public.calendars where owner_id = u and is_default limit 1;
    if u = 'a1111111-1111-1111-1111-111111111111' then perform set_config('test.cal_a', cal::text, true); end if;
    insert into public.events(calendar_id, owner_id, title, starts_at, ends_at)
    values (cal, u, 'event of ' || left(u::text, 1), now() + interval '1 day', now() + interval '1 day 1 hour');
  end loop;
end $$;

-- Calls as a given user (sub + session id) under the authenticated role; returns the SQLSTATE, or null.
create function pg_temp.as_user(uid uuid, session uuid, sql text) returns text
language plpgsql as $$
declare code text := null;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'session_id', session, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  begin execute sql; exception when others then code := sqlstate; end;
  reset role;
  return code;
end $$;

create function pg_temp.count_as(uid uuid, session uuid, sql text) returns int
language plpgsql as $$
declare n int := -1;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'session_id', session, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  begin execute sql into n; exception when others then n := -1; end;
  reset role;
  return n;
end $$;

-- ---------- 1. passkey user, no step-up: no read, no write ----------
do $$
declare
  a uuid := 'a1111111-1111-1111-1111-111111111111';
  sA uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  n int; code text;
begin
  n := pg_temp.count_as(a, sA, 'select count(*) from public.events');
  if n <> 0 then raise exception 'FAIL 1a: expected 0 visible events without step-up, got %', n; end if;

  code := pg_temp.as_user(a, sA, $q$insert into public.events(calendar_id, owner_id, title, starts_at, ends_at)
    values (current_setting('test.cal_a')::uuid, 'a1111111-1111-1111-1111-111111111111', 'x', now(), now() + interval '1 hour')$q$);
  if code is distinct from '42501' then
    raise exception 'FAIL 1b: expected 42501 on insert without step-up, got %', coalesce(code, 'no error');
  end if;
  raise notice 'PASS 1: a passkey account without step-up cannot read or write';
end $$;

-- ---------- 2. valid step-up for this session: access granted ----------
insert into public.passkey_stepups(session_id, user_id, expires_at)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', now() + interval '1 hour');

do $$
declare
  a uuid := 'a1111111-1111-1111-1111-111111111111';
  sA uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  n int; code text;
begin
  n := pg_temp.count_as(a, sA, 'select count(*) from public.events');
  if n <> 1 then raise exception 'FAIL 2a: expected 1 visible event with step-up, got %', n; end if;

  code := pg_temp.as_user(a, sA, $q$insert into public.events(calendar_id, owner_id, title, starts_at, ends_at)
    values (current_setting('test.cal_a')::uuid, 'a1111111-1111-1111-1111-111111111111', 'allowed', now(), now() + interval '1 hour')$q$);
  if code is not null then raise exception 'FAIL 2b: insert refused with %', code; end if;
  raise notice 'PASS 2: a valid step-up opens reads and writes';
end $$;

-- ---------- 3. expired step-up ----------
update public.passkey_stepups set expires_at = now() - interval '1 second'
 where session_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

do $$
declare n int;
begin
  n := pg_temp.count_as('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                        'select count(*) from public.events');
  if n <> 0 then raise exception 'FAIL 3: an expired step-up still opened % rows', n; end if;
  raise notice 'PASS 3: an expired step-up is refused';
end $$;

-- ---------- 4. another user's step-up, same session id ----------
delete from public.passkey_stepups;
insert into public.passkey_stepups(session_id, user_id, expires_at)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b2222222-2222-2222-2222-222222222222', now() + interval '1 hour');

do $$
declare n int;
begin
  n := pg_temp.count_as('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                        'select count(*) from public.events');
  if n <> 0 then raise exception 'FAIL 4: another user step-up opened % rows', n; end if;
  raise notice 'PASS 4: a step-up belonging to another user is refused';
end $$;

-- ---------- 5. same user, another session ----------
delete from public.passkey_stepups;
insert into public.passkey_stepups(session_id, user_id, expires_at)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a1111111-1111-1111-1111-111111111111', now() + interval '1 hour');

do $$
declare n int;
begin
  n := pg_temp.count_as('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                        'select count(*) from public.events');
  if n <> 0 then raise exception 'FAIL 5: a step-up from another session opened % rows', n; end if;
  raise notice 'PASS 5: a step-up from another session is refused';
end $$;

-- ---------- 6. user without a passkey is unaffected ----------
do $$
declare n int;
begin
  n := pg_temp.count_as('c3333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                        'select count(*) from public.events');
  if n <> 1 then raise exception 'FAIL 6: a user without a passkey saw % events without step-up', n; end if;
  raise notice 'PASS 6: no passkey, no step-up required (no regression)';
end $$;

-- ---------- 7. negative control: without the restrictive policy, the bypass works again ----------
drop policy "stepup_required_all" on public.events;

do $$
declare n int;
begin
  n := pg_temp.count_as('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                        'select count(*) from public.events');
  if n = 0 then
    raise exception 'FAIL 7: expected the old behaviour to leak data without the policy, got 0 rows';
  end if;
  raise notice 'PASS 7: without the RLS policy the old design leaks (% rows), which is what the fix closes', n;
end $$;

do $$ begin raise notice 'ALL PASSKEY STEP-UP TESTS PASSED'; end $$;

rollback;
