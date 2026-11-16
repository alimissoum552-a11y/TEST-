-- Reminders: the reminder e-mail is sent once per event start time.
-- reminder_sent_at marks the send. Moving the event or changing its reminder
-- clears the mark so the new reminder is sent.

alter table public.events add column if not exists reminder_sent_at timestamptz;

create or replace function public.reset_reminder_on_change()
returns trigger language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at
     or new.reminder_minutes is distinct from old.reminder_minutes then
    new.reminder_sent_at := null;
  end if;
  return new;
end $$;

drop trigger if exists events_reset_reminder on public.events;
create trigger events_reset_reminder
  before update of starts_at, reminder_minutes on public.events
  for each row execute function public.reset_reminder_on_change();

-- Partial index: only events still waiting for a reminder.
create index if not exists events_reminder_pending_idx
  on public.events(starts_at)
  where reminder_sent_at is null and reminder_minutes is not null;
