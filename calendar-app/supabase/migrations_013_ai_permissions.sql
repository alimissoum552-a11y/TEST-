-- Per-user permissions for what the AI assistant may do on the user's behalf.
-- Everything is off by default: the user opts in from the AI panel settings.
create table if not exists public.ai_permissions (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  can_create  boolean not null default false,
  can_update  boolean not null default false,
  can_delete  boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.ai_permissions enable row level security;

drop policy if exists "ai_permissions_own" on public.ai_permissions;
create policy "ai_permissions_own" on public.ai_permissions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
