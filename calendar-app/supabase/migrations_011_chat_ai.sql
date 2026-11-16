-- AI in the team chat. Only the calendar owner can switch it on or off (calendars_own policy).
-- When on, the AI answers messages that mention it, keeps shared notes, and its replies are stored as chat messages.

-- 1. Switch, owned by the calendar owner.
alter table public.calendars add column if not exists chat_ai_enabled boolean not null default false;

-- 2. AI replies are chat messages flagged as coming from the AI.
alter table public.messages add column if not exists is_ai boolean not null default false;

-- 3. Shared notes kept by the AI for the calendar. Members read them; only the server (service role) writes.
create table if not exists public.chat_ai_notes (
  calendar_id uuid primary key references public.calendars(id) on delete cascade,
  content     text not null default '' check (char_length(content) <= 8000),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

alter table public.chat_ai_notes enable row level security;
drop policy if exists "chat_ai_notes_member_read" on public.chat_ai_notes;
create policy "chat_ai_notes_member_read" on public.chat_ai_notes for select
  using (public.calendar_role(calendar_id, auth.uid()) is not null);

-- Realtime for the switch, so every member sees it change without reloading.
do $$
begin
  alter publication supabase_realtime add table public.calendars;
exception when duplicate_object then null;
end $$;

-- Realtime for the shared notes, so members see the AI's notes update live.
do $$
begin
  alter publication supabase_realtime add table public.chat_ai_notes;
exception when duplicate_object then null;
end $$;
