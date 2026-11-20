-- Regression test for migrations 038 + 039: a password-only session cannot remove passkeys.
-- Deleting a passkey would downgrade the account's security while keeping its data, so it
-- requires a valid server-side step-up. Disposable database only. Rolled back.

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'del-a@example.test', '{"account_type":"adult","display_name":"A"}'),
  ('b2222222-2222-2222-2222-222222222222', 'del-b@example.test', '{"account_type":"adult","display_name":"B"}');

insert into public.webauthn_credentials(user_id, credential_id, public_key, counter) values
  ('a1111111-1111-1111-1111-111111111111', 'cred-a1', 'pk-a1', 0),
  ('a1111111-1111-1111-1111-111111111111', 'cred-a2', 'pk-a2', 0),
  ('b2222222-2222-2222-2222-222222222222', 'cred-b1', 'pk-b1', 0);

create function pg_temp.del_as(uid uuid, session uuid, sql text) returns int
language plpgsql as $$
declare n int := -1;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'session_id', session, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  begin execute sql into n; exception when others then raise notice 'del_as error: % %', sqlstate, sqlerrm; n := -1; end;
  reset role;
  return n;
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

-- 1 + 2. password-only session, whole set and one by id
do $$
declare
  a uuid := 'a1111111-1111-1111-1111-111111111111';
  sA uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  n int; remaining int;
begin
  n := pg_temp.del_as(a, sA, $q$with d as (delete from public.webauthn_credentials where user_id = 'a1111111-1111-1111-1111-111111111111' returning id) select count(*) from d$q$);
  if n <> 0 then raise exception 'FAIL 1: whole-set delete removed % rows without step-up', n; end if;

  n := pg_temp.del_as(a, sA, $q$with d as (delete from public.webauthn_credentials where credential_id = 'cred-a1' returning id) select count(*) from d$q$);
  if n <> 0 then raise exception 'FAIL 2: single delete removed % rows without step-up', n; end if;

  remaining := pg_temp.count_as(a, sA, 'select count(*) from public.webauthn_credentials');
  if remaining <> 2 then raise exception 'FAIL 2b: expected the 2 passkeys to remain, got %', remaining; end if;
  raise notice 'PASS 1-2: a password-only session deletes nothing (2 passkeys intact)';
end $$;

-- 3. anonymous caller
do $$
declare n int := -1;
begin
  set local role anon;
  begin
    with d as (delete from public.webauthn_credentials where user_id = 'a1111111-1111-1111-1111-111111111111' returning id)
    select count(*) into n from d;
  exception when others then n := -1; end;
  reset role;
  if n > 0 then raise exception 'FAIL 3: anonymous deleted % rows', n; end if;
  raise notice 'PASS 3: anonymous deletes nothing';
end $$;

-- 4. with a valid step-up: one, then the last
insert into public.passkey_stepups(session_id, user_id, expires_at)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', now() + interval '1 hour');

do $$
declare
  a uuid := 'a1111111-1111-1111-1111-111111111111';
  sA uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  n int; remaining int;
begin
  n := pg_temp.del_as(a, sA, $q$with d as (delete from public.webauthn_credentials where credential_id = 'cred-a1' returning id) select count(*) from d$q$);
  if n <> 1 then raise exception 'FAIL 4a: expected 1 row deleted with step-up, got %', n; end if;

  remaining := pg_temp.count_as(a, sA, 'select count(*) from public.webauthn_credentials');
  if remaining <> 1 then raise exception 'FAIL 4b: expected 1 passkey left, got %', remaining; end if;

  n := pg_temp.del_as(a, sA, $q$with d as (delete from public.webauthn_credentials where credential_id = 'cred-a2' returning id) select count(*) from d$q$);
  if n <> 1 then raise exception 'FAIL 4c: last passkey not deleted with step-up (got %)', n; end if;
  raise notice 'PASS 4: with a step-up, one then the last passkey are removed';
end $$;

-- 5. once no passkey remains, the account no longer requires a step-up (intended opt-out)
do $$
declare n int;
begin
  n := pg_temp.count_as('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                        'select count(*) from public.events');
  if n < 0 then raise exception 'FAIL 5: the account is still locked after removing its passkeys'; end if;
  raise notice 'PASS 5: without a passkey the account works again (no lock-out)';
end $$;

-- 6. negative control: without the restrictive policy a password-only session can delete
drop policy "stepup_required_delete" on public.webauthn_credentials;

do $$
declare b uuid := 'b2222222-2222-2222-2222-222222222222';
declare sB uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
declare n int;
begin
  n := pg_temp.del_as(b, sB, $q$with d as (delete from public.webauthn_credentials where credential_id = 'cred-b1' returning id) select count(*) from d$q$);
  if n <> 1 then raise exception 'FAIL 6: expected the old behaviour to delete (got %)', n; end if;
  raise notice 'PASS 6: without the policy the old design deletes the passkey, which is what the fix closes';
end $$;

do $$ begin raise notice 'ALL PASSKEY DELETE GUARD TESTS PASSED'; end $$;

rollback;
