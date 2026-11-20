-- 040: OAuth connector grants bound to a fresh passkey check.
--
-- An OAuth access token carries a client_id but no session_id, so the step-up check introduced in
-- 038 cannot see it. A blanket exemption for client_id would reopen the bypass: anyone could get
-- such a token from a password-only session. Instead, the consent screen must prove the passkey
-- right before approving, and that proof is stored as a grant:
--
--   mcp_grants(user_id, client_id, scopes, expires_at, revoked_at)
--
-- stepup_valid() accepts a token only when a live, unrevoked grant exists for exactly that user
-- and client, and the token scopes are a subset of the granted ones. A normal session (no
-- client_id) never matches, and an OAuth token never matches a session step-up.

create table if not exists public.mcp_grants (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  client_id  text not null,
  scopes     text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  primary key (user_id, client_id)
);
create index if not exists mcp_grants_client_idx on public.mcp_grants(client_id);

alter table public.mcp_grants enable row level security;
revoke insert, update, delete on public.mcp_grants from anon, authenticated;
grant select on public.mcp_grants to authenticated;

drop policy if exists "mcp_grants_own_read" on public.mcp_grants;
create policy "mcp_grants_own_read" on public.mcp_grants for select using (user_id = auth.uid());

create or replace function public.jwt_client_id() returns text
language sql stable as $$
  select nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'client_id'), '')
$$;

create or replace function public.jwt_scopes() returns text[]
language sql stable as $$
  select coalesce(string_to_array(nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'scope'), ''), ' '), '{}')
$$;

-- Every scope requested by the token must have been granted at consent time.
create or replace function public.scopes_subset(requested text[], granted text[]) returns boolean
language sql immutable as $$
  select coalesce(requested, '{}') <@ coalesce(granted, '{}')
$$;

revoke all on function public.jwt_client_id() from public;
revoke all on function public.jwt_scopes() from public;
revoke all on function public.scopes_subset(text[], text[]) from public;
grant execute on function public.jwt_client_id() to authenticated, service_role;
grant execute on function public.jwt_scopes() to authenticated, service_role;
grant execute on function public.scopes_subset(text[], text[]) to authenticated, service_role;

create or replace function public.stepup_valid() returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when not public.stepup_required() then true
    when exists (
      select 1 from public.passkey_stepups s
      where s.user_id = auth.uid()
        and s.session_id = public.jwt_session_id()
        and s.expires_at > now()
    ) then true
    else exists (
      select 1 from public.mcp_grants g
      where g.user_id = auth.uid()
        and g.client_id = public.jwt_client_id()
        and g.revoked_at is null
        and g.expires_at > now()
        and public.scopes_subset(public.jwt_scopes(), g.scopes)
    )
  end
$$;
revoke all on function public.stepup_valid() from public;
grant execute on function public.stepup_valid() to authenticated, service_role;
