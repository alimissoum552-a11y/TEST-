-- 037: a WebAuthn challenge is single-use.
--
-- The challenge token is signed and expires after 5 minutes, but nothing prevented the same
-- token (and a captured assertion) from being replayed inside that window. Every verification
-- now records the token id here; the primary key rejects a second use.
-- Service role only: no policy is created, so anon and authenticated are denied by RLS.

create table if not exists public.webauthn_used_challenges (
  jti     uuid primary key,
  used_at timestamptz not null default now()
);
create index if not exists webauthn_used_challenges_time_idx on public.webauthn_used_challenges(used_at);

alter table public.webauthn_used_challenges enable row level security;

revoke all on public.webauthn_used_challenges from public, anon, authenticated;
