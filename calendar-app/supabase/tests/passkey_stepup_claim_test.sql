-- Regression test for migration 038: the passkey sign-in claim is redeemed once, by its owner,
-- before it expires. The statement is the same one the webauthn function runs.
-- Disposable database only. Run with: psql -v ON_ERROR_STOP=1 -f tests/passkey_stepup_claim_test.sql

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('d4444444-4444-4444-4444-444444444444', 'claim-a@example.test', '{"account_type":"adult"}'),
  ('e5555555-5555-5555-5555-555555555555', 'claim-b@example.test', '{"account_type":"adult"}');

-- Same shape as the function: the row is only updated while unused and unexpired.
create function pg_temp.redeem(claim uuid, uid uuid) returns int
language plpgsql as $$
declare got uuid;
begin
  update public.passkey_stepup_claims set used_at = now()
   where id = claim and user_id = uid and used_at is null and expires_at > now()
  returning id into got;
  return case when got is null then 0 else 1 end;
end $$;

do $$
declare claim uuid; first int; second int;
begin
  insert into public.passkey_stepup_claims(user_id, expires_at)
  values ('d4444444-4444-4444-4444-444444444444', now() + interval '5 minutes') returning id into claim;

  first := pg_temp.redeem(claim, 'd4444444-4444-4444-4444-444444444444');
  second := pg_temp.redeem(claim, 'd4444444-4444-4444-4444-444444444444');
  if first <> 1 then raise exception 'FAIL claim: first redemption refused'; end if;
  if second <> 0 then raise exception 'FAIL claim: replay accepted'; end if;
  raise notice 'PASS claim: redeemed once, replay refused';
end $$;

do $$
declare claim uuid; n int;
begin
  insert into public.passkey_stepup_claims(user_id, expires_at)
  values ('d4444444-4444-4444-4444-444444444444', now() - interval '1 second') returning id into claim;
  n := pg_temp.redeem(claim, 'd4444444-4444-4444-4444-444444444444');
  if n <> 0 then raise exception 'FAIL claim: an expired claim was accepted'; end if;
  raise notice 'PASS claim: expired claim refused';
end $$;

do $$
declare claim uuid; n int;
begin
  insert into public.passkey_stepup_claims(user_id, expires_at)
  values ('d4444444-4444-4444-4444-444444444444', now() + interval '5 minutes') returning id into claim;
  n := pg_temp.redeem(claim, 'e5555555-5555-5555-5555-555555555555');
  if n <> 0 then raise exception 'FAIL claim: another user redeemed the claim'; end if;
  raise notice 'PASS claim: another user cannot redeem it';
end $$;

do $$ begin raise notice 'ALL STEP-UP CLAIM TESTS PASSED'; end $$;

rollback;
