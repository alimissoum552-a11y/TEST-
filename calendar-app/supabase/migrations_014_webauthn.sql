-- Passkeys (WebAuthn) as a sign-in method. One row per registered device.
-- Public keys are written and read by the Edge Function with the service role;
-- a signed-in user may only list and remove their own credentials.
create table if not exists public.webauthn_credentials (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  credential_id text not null unique,
  public_key    text not null,
  counter       bigint not null default 0,
  transports    text[] not null default '{}',
  device_label  text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists webauthn_credentials_user_idx on public.webauthn_credentials(user_id);

alter table public.webauthn_credentials enable row level security;

drop policy if exists "webauthn_own_read" on public.webauthn_credentials;
create policy "webauthn_own_read" on public.webauthn_credentials for select using (user_id = auth.uid());

drop policy if exists "webauthn_own_delete" on public.webauthn_credentials;
create policy "webauthn_own_delete" on public.webauthn_credentials for delete using (user_id = auth.uid());
