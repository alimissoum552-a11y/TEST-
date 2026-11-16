-- Team chat per calendar. Messages are readable by every member of the calendar (including readers),
-- writable by owners, administrators and contributors only, and each author can delete their own message.

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists messages_calendar_time_idx on public.messages(calendar_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "messages_member_read" on public.messages;
create policy "messages_member_read" on public.messages for select
  using (public.calendar_role(calendar_id, auth.uid()) is not null);

drop policy if exists "messages_writer_insert" on public.messages;
create policy "messages_writer_insert" on public.messages for insert
  with check (
    user_id = auth.uid()
    and public.calendar_role(calendar_id, auth.uid()) in ('owner', 'administrator', 'contributor')
  );

drop policy if exists "messages_own_delete" on public.messages;
create policy "messages_own_delete" on public.messages for delete
  using (user_id = auth.uid());

-- Realtime: subscribers only receive rows their SELECT policy allows.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
