-- 038: server-side passkey step-up.
--
-- Before: the app decided in the browser (sessionStorage) whether the second factor was done.
-- A user could flip that flag and use the session without ever passing the passkey check.
--
-- Now: a successful passkey verification writes a step-up row bound to the Supabase session id
-- carried in the JWT. A restrictive RLS policy on the content tables requires that row, so the
-- database - not the browser - decides. Users without a passkey are unaffected (stepup_valid()
-- returns true for them).
--
-- The elevation lasts 12 hours and is bound to one session: signing in again creates a new
-- session id and requires a new passkey check. A shorter window would need silent re-prompts,
-- which a platform authenticator cannot do without the user.

create table if not exists public.passkey_stepups (
  session_id uuid primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists passkey_stepups_user_idx on public.passkey_stepups(user_id);

-- A passkey sign-in creates a session on the client, after the assertion is verified. The claim
-- is the server-side proof that the assertion succeeded, redeemed once for that new session.
create table if not exists public.passkey_stepup_claims (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index if not exists passkey_stepup_claims_user_idx on public.passkey_stepup_claims(user_id);

alter table public.passkey_stepups        enable row level security;
alter table public.passkey_stepup_claims  enable row level security;
revoke all on public.passkey_stepups       from public, anon, authenticated;
revoke all on public.passkey_stepup_claims from public, anon, authenticated;

-- The session id is a claim of the JWT that PostgREST validated.
create or replace function public.jwt_session_id() returns uuid
language sql stable as $$
  select nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id'), '')::uuid
$$;
revoke all on function public.jwt_session_id() from public;
grant execute on function public.jwt_session_id() to authenticated, service_role;

create or replace function public.stepup_required() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.webauthn_credentials where user_id = auth.uid())
$$;

create or replace function public.stepup_valid() returns boolean
language sql stable security definer set search_path = public as $$
  select not public.stepup_required()
      or exists (
        select 1 from public.passkey_stepups s
        where s.user_id = auth.uid()
          and s.session_id = public.jwt_session_id()
          and s.expires_at > now()
      )
$$;
revoke all on function public.stepup_required() from public;
revoke all on function public.stepup_valid() from public;
grant execute on function public.stepup_required() to authenticated, service_role;
grant execute on function public.stepup_valid() to authenticated, service_role;

-- Restrictive policies: they are ANDed with the existing permissive policies, so no historical
-- policy is rewritten. A passkey account without a live step-up reaches none of these tables.
do $$
declare t text;
begin
  foreach t in array array[
    'events', 'calendars', 'calendar_members', 'calendar_invites', 'event_history',
    'messages', 'chat_ai_notes', 'ai_permissions', 'notifications',
    'managed_profiles', 'declarations', 'wellbeing_checkins', 'wellbeing_settings'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "stepup_required_all" on public.%I', t);
      execute format(
        'create policy "stepup_required_all" on public.%I as restrictive for all using (public.stepup_valid()) with check (public.stepup_valid())',
        t);
    end if;
  end loop;

  -- Profiles and passkeys stay readable before the step-up: the app must be able to know that a
  -- passkey exists (and to show the account) in order to ask for it. Writes require the proof.
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "stepup_required_write" on public.profiles';
    execute 'create policy "stepup_required_write" on public.profiles as restrictive for update using (public.stepup_valid()) with check (public.stepup_valid())';
    execute 'drop policy if exists "stepup_required_delete" on public.profiles';
    execute 'create policy "stepup_required_delete" on public.profiles as restrictive for delete using (public.stepup_valid())';
  end if;
  if to_regclass('public.webauthn_credentials') is not null then
    execute 'drop policy if exists "stepup_required_delete" on public.webauthn_credentials';
    execute 'create policy "stepup_required_delete" on public.webauthn_credentials as restrictive for delete using (public.stepup_valid())';
  end if;
end $$;
