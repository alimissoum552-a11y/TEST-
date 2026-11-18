-- 024: security hardening found by the security audit (docs/SECURITY_AUDIT.md).
--
-- 1. A caller with no role (anonymous, or signed in but not a member) made `calendar_role(...) not in (...)`
--    evaluate to NULL, so the "not allowed" error was never raised. Any signed-in user could invite themselves
--    to any calendar as administrator and accept; an anonymous caller could restore (and read) event versions,
--    create invites and decline invites. NULL now counts as "no role".
-- 2. Public API access (/rest/v1/rpc/...) is closed for anonymous visitors, and for the functions that only
--    triggers or the scheduler use.

CREATE OR REPLACE FUNCTION public.accept_invite(inv uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  i calendar_invites;
begin
  select * into i from calendar_invites where id = inv;
  if not found or auth.uid() is null or lower(i.invitee_email) is distinct from public.current_user_email() then raise exception 'not allowed'; end if;
  if i.status <> 'pending' then raise exception 'invite already answered'; end if;
  insert into calendar_members(calendar_id, user_id, role)
  values (i.calendar_id, auth.uid(), i.role)
  on conflict (calendar_id, user_id) do update set role = excluded.role;
  update calendar_invites set status = 'accepted', invitee_id = auth.uid(), responded_at = now() where id = inv;
end $function$;

CREATE OR REPLACE FUNCTION public.decline_invite(inv uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  i calendar_invites;
begin
  select * into i from calendar_invites where id = inv;
  if not found or auth.uid() is null or lower(i.invitee_email) is distinct from public.current_user_email() then raise exception 'not allowed'; end if;
  if i.status <> 'pending' then raise exception 'invite already answered'; end if;
  update calendar_invites set status = 'declined', responded_at = now() where id = inv;
end $function$;

CREATE OR REPLACE FUNCTION public.invite_to_calendar(cal uuid, target_email text, target_role text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  inv_id uuid;
begin
  if coalesce(public.calendar_role(cal, auth.uid()), '') not in ('owner','administrator') then
    raise exception 'not allowed';
  end if;
  insert into calendar_invites(calendar_id, invitee_email, invitee_id, role, invited_by)
  values (cal, lower(target_email),
          (select id from profiles where lower(email) = lower(target_email)),
          target_role, auth.uid())
  on conflict (calendar_id, invitee_email)
    do update set role = excluded.role, status = 'pending', responded_at = null, invited_by = auth.uid()
  returning id into inv_id;
  return inv_id;
end $function$;

CREATE OR REPLACE FUNCTION public.restore_event_version(history_id bigint)
 RETURNS events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  h event_history;
  snap jsonb;
  result events;
begin
  select * into h from event_history where id = history_id;
  if not found then raise exception 'history entry not found'; end if;
  if coalesce(public.calendar_role(h.calendar_id, auth.uid()), '') not in ('owner','administrator','contributor') then
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
end $function$;

-- Anonymous visitors call none of these. Signed-in users keep the ones the app uses.
do $$
declare f text;
begin
  foreach f in array array[
    'accept_invite(uuid)', 'add_guardian_by_email(uuid,text)', 'calendar_busy(uuid,timestamptz,timestamptz)',
    'calendar_role(uuid,uuid)', 'current_user_email()', 'decline_invite(uuid)', 'find_user_for_share(uuid,text)',
    'invite_to_calendar(uuid,text,text)', 'is_calendar_owner_of_profile(uuid)', 'is_guardian_of_profile(uuid)',
    'is_minor(uuid)', 'minor_ai_allowed(uuid)', 'my_pending_invites()', 'restore_event_version(bigint)',
    'sign_managed_profile(uuid,text,text,text[],text)', 'team_member_names(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;

  -- Trigger functions and the scheduled purge are never called through the API (the scheduler runs as postgres).
  foreach f in array array[
    'guardian_invites_on_confirm()', 'handle_new_user()', 'log_event_change()', 'notify_mentions()',
    'require_verified_creator()', 'purge_stale_pending_profiles()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
