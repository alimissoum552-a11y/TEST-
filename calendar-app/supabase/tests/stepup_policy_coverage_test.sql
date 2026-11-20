-- Regression test for migrations 038 + 039: every content table carries the restrictive step-up
-- policy, and the helpers fail closed. Disposable database only. Rolled back.

begin;

do $$
declare t text; missing text := '';
begin
  foreach t in array array[
    'events','calendars','calendar_members','calendar_invites','event_history','messages',
    'chat_ai_notes','ai_permissions','notifications','managed_profiles','declarations',
    'wellbeing_checkins','wellbeing_settings'] loop
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=t and permissive='RESTRICTIVE'
        and coalesce(qual,'') like '%stepup_valid%'
    ) then
      missing := missing || t || ' ';
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.'||t)::regclass) then
      missing := missing || t || '(rls) ';
    end if;
  end loop;
  if missing <> '' then raise exception 'FAIL coverage: %', missing; end if;
  raise notice 'PASS coverage: 13 tables have RLS and a restrictive step-up policy';
end $$;

-- Anonymous: stepup_valid() must be false, even though no passkey exists for "no user".
do $$
declare v boolean;
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  select public.stepup_valid() into v;
  reset role;
  if v is not false then raise exception 'FAIL: stepup_valid() returned % for an anonymous caller', v; end if;
  raise notice 'PASS anonymous: stepup_valid() is false';
end $$;

-- A signed-in user without a passkey is allowed (no regression).
do $$
declare v boolean;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub','a1111111-1111-1111-1111-111111111111','session_id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::text, true);
  perform set_config('request.jwt.claim.sub','a1111111-1111-1111-1111-111111111111', true);
  insert into auth.users (id, email, raw_user_meta_data)
  values ('a1111111-1111-1111-1111-111111111111','cov-a@example.test','{"account_type":"adult"}')
  on conflict (id) do nothing;
  set local role authenticated;
  select public.stepup_valid() into v;
  reset role;
  if v is not true then raise exception 'FAIL: a user without a passkey was refused (stepup_valid=%)', v; end if;
  raise notice 'PASS no-passkey user: stepup_valid() is true';
end $$;

-- A passkey user without a step-up is refused.
do $$
declare v boolean;
begin
  insert into public.webauthn_credentials(user_id, credential_id, public_key)
  values ('a1111111-1111-1111-1111-111111111111','cov-cred','cov-pk')
  on conflict (credential_id) do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub','a1111111-1111-1111-1111-111111111111','session_id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::text, true);
  perform set_config('request.jwt.claim.sub','a1111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  select public.stepup_valid() into v;
  reset role;
  if v is not false then raise exception 'FAIL: a passkey user without step-up was allowed (%)', v; end if;
  raise notice 'PASS passkey user without step-up: refused';
end $$;

do $$ begin raise notice 'ALL STEP-UP POLICY TESTS PASSED'; end $$;

rollback;
