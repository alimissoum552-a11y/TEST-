-- Phase 1: sharing with roles, event history, realtime publication.

-- Members of a calendar, with a role.
create table if not exists public.calendar_members (
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('administrator','contributor','reader')),
  created_at  timestamptz not null default now(),
  primary key (calendar_id, user_id)
);
create index if not exists calendar_members_user_idx on public.calendar_members(user_id);

-- Activity log of event changes.
create table if not exists public.event_history (
  id         bigint generated always as identity primary key,
  event_id   uuid not null,
  calendar_id uuid not null,
  actor_id   uuid,
  action     text not null check (action in ('insert','update','delete')),
  snapshot   jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists event_history_event_idx on public.event_history(event_id, created_at desc);

-- Helper: user's effective role on a calendar (owner counts as administrator).
create or replace function public.calendar_role(cal uuid, uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from calendars c where c.id = cal and c.owner_id = uid) then 'owner'
    else (select m.role from calendar_members m where m.calendar_id = cal and m.user_id = uid)
  end
$$;

-- Replace the owner-only event policy with role-based access.
drop policy if exists "events_own" on public.events;
drop policy if exists "events_select" on public.events;
drop policy if exists "events_insert" on public.events;
drop policy if exists "events_update" on public.events;
drop policy if exists "events_delete" on public.events;

create policy "events_select" on public.events for select using (
  public.calendar_role(calendar_id, auth.uid()) is not null
);
create policy "events_insert" on public.events for insert with check (
  public.calendar_role(calendar_id, auth.uid()) in ('owner','administrator','contributor')
  and owner_id = auth.uid()
);
create policy "events_update" on public.events for update using (
  public.calendar_role(calendar_id, auth.uid()) in ('owner','administrator','contributor')
);
create policy "events_delete" on public.events for delete using (
  public.calendar_role(calendar_id, auth.uid()) in ('owner','administrator')
);

-- Calendar members policies: owner/administrator manage, members read their own rows.
alter table public.calendar_members enable row level security;
drop policy if exists "members_select" on public.calendar_members;
create policy "members_select" on public.calendar_members for select using (
  user_id = auth.uid() or public.calendar_role(calendar_id, auth.uid()) is not null
);
drop policy if exists "members_manage" on public.calendar_members;
create policy "members_manage" on public.calendar_members for all using (
  public.calendar_role(calendar_id, auth.uid()) in ('owner','administrator')
) with check (
  public.calendar_role(calendar_id, auth.uid()) in ('owner','administrator')
);

-- History: readable by calendar members, written by trigger only.
alter table public.event_history enable row level security;
drop policy if exists "history_select" on public.event_history;
create policy "history_select" on public.event_history for select using (
  public.calendar_role(calendar_id, auth.uid()) is not null
);

-- Trigger: record every insert / update / delete on events.
create or replace function public.log_event_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'DELETE') then
    insert into event_history(event_id, calendar_id, actor_id, action, snapshot)
    values (old.id, old.calendar_id, auth.uid(), 'delete', to_jsonb(old));
    return old;
  else
    insert into event_history(event_id, calendar_id, actor_id, action, snapshot)
    values (new.id, new.calendar_id, auth.uid(), lower(tg_op), to_jsonb(new));
    return new;
  end if;
end $$;

drop trigger if exists events_log on public.events;
create trigger events_log after insert or update or delete on public.events
for each row execute function public.log_event_change();

-- Realtime: publish changes so clients receive live updates.
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.calendar_members;
exception when duplicate_object then null; end $$;
