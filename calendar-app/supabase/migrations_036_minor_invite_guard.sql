-- 036: a minor account must not accept a general calendar invitation.
--
-- Minor access goes through the managed-minor flow (guardian approval), never through the general
-- invitation. The guard is checked after identity verification and before any write, so a rejected
-- caller cannot receive membership nor change the invitation state.
--
-- Unauthorized callers now raise SQLSTATE 42501. The message stays 'not allowed' for existing clients.
-- Signature, SECURITY DEFINER, search_path and grants (set in 024) are unchanged.

create or replace function public.accept_invite(inv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  i calendar_invites;
begin
  select * into i from calendar_invites where id = inv;
  if not found
     or auth.uid() is null
     or lower(i.invitee_email) is distinct from public.current_user_email() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- A minor is never admitted through a general invitation.
  if public.is_minor(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if i.status <> 'pending' then raise exception 'invite already answered'; end if;

  insert into calendar_members(calendar_id, user_id, role)
  values (i.calendar_id, auth.uid(), i.role)
  on conflict (calendar_id, user_id) do update set role = excluded.role;

  update calendar_invites set status = 'accepted', invitee_id = auth.uid(), responded_at = now() where id = inv;
end $$;
