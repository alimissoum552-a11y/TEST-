-- Member handles (@pseudo) and mention notifications.
-- A handle is unique, 3 to 20 letters, digits or underscores, and cannot be an AI name (ai, ia, ki).
-- The default handle does not use the e-mail address, so nothing personal is shown to other members.

-- 1. Handles
alter table public.profiles add column if not exists handle text;

update public.profiles
   set handle = 'member_' || substr(md5(id::text), 1, 8)
 where handle is null;

alter table public.profiles alter column handle set default ('member_' || substr(md5(gen_random_uuid()::text), 1, 8));
alter table public.profiles alter column handle set not null;

do $$
begin
  alter table public.profiles add constraint profiles_handle_format
    check (handle ~ '^[a-z0-9_]{3,20}$' and handle not in ('ai', 'ia', 'ki'));
exception when duplicate_object then null;
end $$;

create unique index if not exists profiles_handle_key on public.profiles (lower(handle));

-- 2. Notifications for mentions. Written by the trigger below (security definer); each user reads and marks their own.
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null default 'mention' check (kind in ('mention')),
  calendar_id uuid references public.calendars(id) on delete cascade,
  message_id  uuid references public.messages(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_own_read" on public.notifications;
create policy "notifications_own_read" on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists "notifications_own_mark_read" on public.notifications;
create policy "notifications_own_mark_read" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Mentions: every @handle in a human message that names a member of that calendar (not the author) gets one notification.
create or replace function public.notify_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  h text;
  target uuid;
begin
  if new.is_ai then return new; end if;
  for h in
    select distinct lower(m[1]) from regexp_matches(new.content, '@([A-Za-z0-9_]{3,20})', 'g') as m
  loop
    select p.id into target
      from public.profiles p
     where lower(p.handle) = h
       and p.id <> new.user_id
       and public.calendar_role(new.calendar_id, p.id) is not null;
    if found then
      insert into public.notifications (user_id, calendar_id, message_id, actor_id)
      values (target, new.calendar_id, new.id, new.user_id);
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists messages_notify_mentions on public.messages;
create trigger messages_notify_mentions after insert on public.messages
  for each row execute function public.notify_mentions();

-- 4. Realtime: a member receives their own notifications as they arrive.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
