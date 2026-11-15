-- Phase 1b: invite-by-email lookup and restore-to-version support.

-- Resolve an email to a user id, only for an admin of the target calendar.
-- Returns nothing for anyone else, so emails are not enumerable.
create or replace function public.find_user_for_share(cal uuid, target_email text)
returns table (user_id uuid, display_name text, email text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.email
  from profiles p
  where lower(p.email) = lower(target_email)
    and public.calendar_role(cal, auth.uid()) in ('owner','administrator')
$$;

-- Restore an event to a previous snapshot. Caller needs write access.
create or replace function public.restore_event_version(history_id bigint)
returns events
language plpgsql security definer set search_path = public as $$
declare
  h event_history;
  snap jsonb;
  result events;
begin
  select * into h from event_history where id = history_id;
  if not found then raise exception 'history entry not found'; end if;
  if public.calendar_role(h.calendar_id, auth.uid()) not in ('owner','administrator','contributor') then
    raise exception 'not allowed';
  end if;
  snap := h.snapshot;
  update events set
    title = snap->>'title',
    description = snap->>'description',
    location = snap->>'location',
    starts_at = (snap->>'starts_at')::timestamptz,
    ends_at = (snap->>'ends_at')::timestamptz,
    color_tone = snap->>'color_tone',
    reminder_minutes = (snap->>'reminder_minutes')::int
  where id = h.event_id
  returning * into result;
  return result;
end $$;
