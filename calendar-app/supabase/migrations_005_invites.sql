-- Invitations: a pending invite does not grant access until the invitee accepts.

create table if not exists public.calendar_invites (
  id           uuid primary key default gen_random_uuid(),
  calendar_id  uuid not null references public.calendars(id) on delete cascade,
  invitee_email text not null,
  invitee_id   uuid references public.profiles(id) on delete cascade,
  role         text not null check (role in ('administrator','contributor','reader')),
  invited_by   uuid references public.profiles(id) on delete set null,
  status       text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  unique (calendar_id, invitee_email)
);
create index if not exists calendar_invites_invitee_idx on public.calendar_invites(invitee_id, status);

alter table public.calendar_invites enable row level security;

-- Inviter (admin/owner) sees and manages invites of their calendar.
drop policy if exists "invites_admin_all" on public.calendar_invites;
create policy "invites_admin_all" on public.calendar_invites for all
  using (public.calendar_role(calendar_id, auth.uid()) in ('owner','administrator'))
  with check (public.calendar_role(calendar_id, auth.uid()) in ('owner','administrator'));

-- Invitee sees invites addressed to their account email.
drop policy if exists "invites_invitee_read" on public.calendar_invites;
create policy "invites_invitee_read" on public.calendar_invites for select
  using (lower(invitee_email) = lower((select email from auth.users where id = auth.uid())));

-- Invitee can answer (status change only) an invite addressed to them.
drop policy if exists "invites_invitee_respond" on public.calendar_invites;
create policy "invites_invitee_respond" on public.calendar_invites for update
  using (lower(invitee_email) = lower((select email from auth.users where id = auth.uid())))
  with check (lower(invitee_email) = lower((select email from auth.users where id = auth.uid())));

-- Create an invite (admins only). Membership is NOT created here.
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

-- Accept: creates the membership, marks the invite accepted. Invitee only.
create or replace function public.accept_invite(inv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  i calendar_invites;
  my_email text;
begin
  select email into my_email from auth.users where id = auth.uid();
  select * into i from calendar_invites where id = inv;
  if not found or lower(i.invitee_email) <> lower(my_email) then raise exception 'not allowed'; end if;
  if i.status <> 'pending' then raise exception 'invite already answered'; end if;
  insert into calendar_members(calendar_id, user_id, role)
  values (i.calendar_id, auth.uid(), i.role)
  on conflict (calendar_id, user_id) do update set role = excluded.role;
  update calendar_invites set status = 'accepted', invitee_id = auth.uid(), responded_at = now() where id = inv;
end $$;

-- Decline: marks the invite declined, grants nothing. Invitee only.
create or replace function public.decline_invite(inv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  i calendar_invites;
  my_email text;
begin
  select email into my_email from auth.users where id = auth.uid();
  select * into i from calendar_invites where id = inv;
  if not found or lower(i.invitee_email) <> lower(my_email) then raise exception 'not allowed'; end if;
  if i.status <> 'pending' then raise exception 'invite already answered'; end if;
  update calendar_invites set status = 'declined', responded_at = now() where id = inv;
end $$;

-- Pending invites addressed to the caller, with calendar name and inviter.
create or replace function public.my_pending_invites()
returns table (id uuid, calendar_id uuid, calendar_name text, role text, inviter_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.calendar_id, c.name, i.role, coalesce(p.display_name, p.email), i.created_at
  from calendar_invites i
  join calendars c on c.id = i.calendar_id
  left join profiles p on p.id = i.invited_by
  where i.status = 'pending'
    and lower(i.invitee_email) = lower((select email from auth.users where id = auth.uid()))
  order by i.created_at desc
$$;
