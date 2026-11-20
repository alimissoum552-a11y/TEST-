-- Regression test for migration 037: a WebAuthn challenge can be verified once.
-- Disposable database only. Prerequisite: migrations_037_webauthn_single_use.sql applied.
-- Run with: psql -v ON_ERROR_STOP=1 -f tests/webauthn_challenge_single_use_test.sql

begin;

do $$
begin
  if to_regclass('public.webauthn_used_challenges') is null then
    raise exception 'prerequisite: migration 037 not applied';
  end if;
end $$;

-- 1. first use accepted
insert into public.webauthn_used_challenges(jti) values ('44444444-4444-4444-4444-444444444444');
do $$ begin raise notice 'PASS first use accepted'; end $$;

-- 2. replay rejected by the primary key
do $$
declare code text := null;
begin
  begin
    insert into public.webauthn_used_challenges(jti) values ('44444444-4444-4444-4444-444444444444');
  exception when others then code := sqlstate; end;
  if code is distinct from '23505' then
    raise exception 'FAIL replay: expected 23505, got %', coalesce(code, 'no error');
  end if;
  raise notice 'PASS replay rejected with 23505';
end $$;

-- 3. an authenticated user can neither read nor write the table
do $$
declare code_read text := null; code_write text := null;
begin
  set local role authenticated;
  begin perform 1 from public.webauthn_used_challenges limit 1; exception when others then code_read := sqlstate; end;
  begin insert into public.webauthn_used_challenges(jti) values ('55555555-5555-5555-5555-555555555555'); exception when others then code_write := sqlstate; end;
  reset role;
  if code_read is null then raise exception 'FAIL: authenticated can read the table'; end if;
  if code_write is null then raise exception 'FAIL: authenticated can write the table'; end if;
  raise notice 'PASS authenticated denied (read %, write %)', code_read, code_write;
end $$;

do $$ begin raise notice 'ALL WEBAUTHN SINGLE-USE TESTS PASSED'; end $$;

rollback;
