-- Regression test for migration 040: an OAuth connector is allowed only through a live grant
-- bound to the same user, the same client, and a subset of the scopes. Rolled back.

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'mcp-a@example.test', '{"account_type":"adult"}'),
  ('c3333333-3333-3333-3333-333333333333', 'mcp-c@example.test', '{"account_type":"adult"}'),
  ('d4444444-4444-4444-4444-444444444444', 'mcp-d@example.test', '{"account_type":"adult"}');
-- A and B have a passkey, D has none (the "no regression" case).
insert into public.webauthn_credentials(user_id, credential_id, public_key)
values ('a1111111-1111-1111-1111-111111111111','mcp-cred-a','mcp-pk-a'),
       ('c3333333-3333-3333-3333-333333333333','mcp-cred-c','mcp-pk-c');

create or replace function pg_temp.valid_with(claims jsonb) returns boolean
language plpgsql as $$
declare v boolean;
begin
  perform set_config('request.jwt.claims', claims::text, true);
  perform set_config('request.jwt.claim.sub', claims->>'sub', true);
  set local role authenticated;
  select public.stepup_valid() into v;
  reset role;
  return v;
end $$;

insert into public.mcp_grants(user_id, client_id, scopes, expires_at)
values ('a1111111-1111-1111-1111-111111111111', '11111111-2222-3333-4444-555555555555',
        '{openid,profile,email}', now() + interval '30 days');

do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111';
begin
  -- A: matching client and scopes
  if not pg_temp.valid_with(jsonb_build_object('sub',a,'client_id','11111111-2222-3333-4444-555555555555','scope','openid profile email')) then
    raise exception 'FAIL A: a valid grant was refused';
  end if;
  raise notice 'PASS A: grant for the same client and scopes opens the connector';

  -- B: another client
  if pg_temp.valid_with(jsonb_build_object('sub',a,'client_id','99999999-9999-9999-9999-999999999999','scope','openid profile email')) then
    raise exception 'FAIL B: another client was allowed';
  end if;
  raise notice 'PASS B: another client is refused';

  -- C: scope widening
  if pg_temp.valid_with(jsonb_build_object('sub',a,'client_id','11111111-2222-3333-4444-555555555555','scope','openid profile email admin')) then
    raise exception 'FAIL C: an extra scope was allowed';
  end if;
  raise notice 'PASS C: a scope that was not granted is refused';

  -- F: a normal session (no client_id) cannot ride on the grant
  if pg_temp.valid_with(jsonb_build_object('sub',a,'session_id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','scope','openid profile email')) then
    raise exception 'FAIL F: a session without step-up used the OAuth grant';
  end if;
  raise notice 'PASS F: the grant does not open a normal session';
end $$;

-- D: expired grant
update public.mcp_grants set expires_at = now() - interval '1 second';
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111';
begin
  if pg_temp.valid_with(jsonb_build_object('sub',a,'client_id','11111111-2222-3333-4444-555555555555','scope','openid')) then
    raise exception 'FAIL D: an expired grant was accepted';
  end if;
  raise notice 'PASS D: an expired grant is refused';
end $$;

-- E: revoked grant
update public.mcp_grants set expires_at = now() + interval '30 days', revoked_at = now();
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111';
begin
  if pg_temp.valid_with(jsonb_build_object('sub',a,'client_id','11111111-2222-3333-4444-555555555555','scope','openid')) then
    raise exception 'FAIL E: a revoked grant was accepted';
  end if;
  raise notice 'PASS E: a revoked grant is refused';
end $$;

-- wrong user: B has a passkey but no grant
do $$
declare b uuid := 'c3333333-3333-3333-3333-333333333333';
begin
  if pg_temp.valid_with(jsonb_build_object('sub',b,'client_id','11111111-2222-3333-4444-555555555555','scope','openid')) then
    raise exception 'FAIL: another user used the grant';
  end if;
  raise notice 'PASS: another user cannot use the grant';
end $$;

-- G: an account without a passkey is unaffected
do $$
declare b uuid := 'd4444444-4444-4444-4444-444444444444';
begin
  if not pg_temp.valid_with(jsonb_build_object('sub',b,'client_id','11111111-2222-3333-4444-555555555555','scope','openid')) then
    raise exception 'FAIL G: a user without a passkey was blocked';
  end if;
  raise notice 'PASS G: no passkey, no grant needed (no regression)';
end $$;

-- H: a signed-in user cannot write the grants table
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111'; code text := null;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub',a)::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  begin
    insert into public.mcp_grants(user_id, client_id, scopes, expires_at)
    values (a, '99999999-9999-9999-9999-999999999999', '{openid}', now() + interval '1 day');
  exception when others then code := sqlstate; end;
  reset role;
  if code is null then raise exception 'FAIL H: a user wrote the grants table'; end if;
  raise notice 'PASS H: users cannot write grants themselves (%)', code;
end $$;

do $$ begin raise notice 'ALL MCP GRANT TESTS PASSED'; end $$;

rollback;
