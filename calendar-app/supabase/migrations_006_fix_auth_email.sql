-- Fix: "permission denied for table users".
-- Authenticated users cannot read auth.users. Read the caller's email through a
-- security definer function instead, and use it in the invite policies and functions.

create or replace function public.current_user_email()
returns text language sql stable security definer set search_path = public, auth as $$
  select lower(email) from auth.users where id = auth.uid()
$$;
revoke all on function public.current_user_email() from public;
grant execute on function public.current_user_email() to authenticated;

-- Invitee policies use the helper instead of reading auth.users directly.
drop policy if exists "invites_invitee_read" on public.calendar_invites;
create policy "invites_invitee_read" on public.calendar_invites for select
  using (lower(invitee_email) = public.current_user_email());

drop policy if exists "invites_invitee_respond" on public.calendar_invites;
create policy "invites_invitee_respond" on public.calendar_invites for update
  using (lower(invitee_email) = public.current_user_email())
  with check (lower(invitee_email) = public.current_user_email());

-- Accept / decline / list: compare against the helper.
create or replace function public.accept_invite(inv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  i calendar_invites;
begin
  select * into i from calendar_invites where id = inv;
  if not found or lower(i.invitee_email) <> public.current_user_email() then raise exception 'not allowed'; end if;
  if i.status <> 'pending' then raise exception 'invite already answered'; end if;
  insert into calendar_members(calendar_id, user_id, role)
  values (i.calendar_id, auth.uid(), i.role)
  on conflict (calendar_id, user_id) do update set role = excluded.role;
  update calendar_invites set status = 'accepted', invitee_id = auth.uid(), responded_at = now() where id = inv;
end $$;

create or replace function public.decline_invite(inv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  i calendar_invites;
begin
  select * into i from calendar_invites where id = inv;
  if not found or lower(i.invitee_email) <> public.current_user_email() then raise exception 'not allowed'; end if;
  if i.status <> 'pending' then raise exception 'invite already answered'; end if;
  update calendar_invites set status = 'declined', responded_at = now() where id = inv;
end $$;

create or replace function public.my_pending_invites()
returns table (id uuid, calendar_id uuid, calendar_name text, role text, inviter_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.calendar_id, c.name, i.role, coalesce(p.display_name, p.email), i.created_at
  from calendar_invites i
  join calendars c on c.id = i.calendar_id
  left join profiles p on p.id = i.invited_by
  where i.status = 'pending'
    and lower(i.invitee_email) = public.current_user_email()
  order by i.created_at desc
$$;

-- Invite creation: looks up the invitee's account id by email, without exposing auth.users.
create or replace function public.invite_to_calendar(cal uuid, target_email text, target_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv_id uuid;
begin
  if public.calendar_role(cal, auth.uid()) not in ('owner','administrator') then
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
end $$;
