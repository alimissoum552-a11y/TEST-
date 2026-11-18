-- Security regression test. Run through the Management API (or the SQL editor) AFTER migration 024.
-- It always ends with an exception, so nothing is kept. Expected message: every line says "blocked".
do $$
declare
  out text := ''; c calendars; h event_history; inv uuid; stranger uuid; semail text;
begin
  select * into c from calendars order by created_at limit 1;
  select * into h from event_history order by id desc limit 1;
  select u.id, u.email into stranger, semail from auth.users u
   where not exists (select 1 from calendar_members m where m.calendar_id = c.id and m.user_id = u.id) and u.id <> c.owner_id limit 1;
  insert into calendar_invites(calendar_id, invitee_email, role, invited_by) values (c.id, 'victim-test@example.com', 'reader', c.owner_id) returning id into inv;

  begin set local role anon; perform public.decline_invite(inv); reset role; out := out || 'decline_invite as anon: NOT BLOCKED | ';
  exception when others then reset role; out := out || 'decline_invite as anon: blocked | '; end;

  begin set local role anon; perform public.restore_event_version(h.id); reset role; out := out || 'restore_event_version as anon: NOT BLOCKED | ';
  exception when others then reset role; out := out || 'restore_event_version as anon: blocked | '; end;

  begin set local role anon; perform public.invite_to_calendar(c.id, 'attacker-test@example.com', 'administrator'); reset role; out := out || 'invite_to_calendar as anon: NOT BLOCKED | ';
  exception when others then reset role; out := out || 'invite_to_calendar as anon: blocked | '; end;

  begin set local role anon; perform public.purge_stale_pending_profiles(); reset role; out := out || 'purge as anon: NOT BLOCKED | ';
  exception when others then reset role; out := out || 'purge as anon: blocked | '; end;

  -- A signed-in user who is not a member must not be able to join a calendar by inviting themselves.
  begin
    perform set_config('request.jwt.claim.sub', stranger::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.invite_to_calendar(c.id, semail, 'administrator');
    reset role; out := out || 'non-member invite_to_calendar: NOT BLOCKED | ';
  exception when others then reset role; out := out || 'non-member invite_to_calendar: blocked | '; end;

  begin
    set local role authenticated;
    perform public.restore_event_version(h.id);
    reset role; out := out || 'non-member restore_event_version: NOT BLOCKED | ';
  exception when others then reset role; out := out || 'non-member restore_event_version: blocked | '; end;

  raise exception 'RESULTS: %', out;
end $$;
