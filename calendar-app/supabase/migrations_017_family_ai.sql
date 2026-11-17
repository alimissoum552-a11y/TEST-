-- AI for family, sports and class calendars with minors (docs/FAMILY_TEAM.md, sections 8 and 14.5).
-- 1. The legal approval is recorded by the operator after the legal review. No client policy can write it.
-- 2. AI is allowed for a calendar only if: the approval exists AND every active minor has a signed declaration covering "ai".
-- 3. A second adult guardian can be added by the calendar owner, by the account e-mail.

create table if not exists public.ai_legal_approvals (
  calendar_id  uuid primary key references public.calendars(id) on delete cascade,
  reference    text not null check (char_length(reference) between 3 and 120),
  approved_by  text not null check (char_length(approved_by) between 2 and 120),
  approved_at  timestamptz not null default now()
);
alter table public.ai_legal_approvals enable row level security;
drop policy if exists "ai_approval_owner_read" on public.ai_legal_approvals;
create policy "ai_approval_owner_read" on public.ai_legal_approvals for select using (
  exists (select 1 from public.calendars c where c.id = calendar_id and c.owner_id = auth.uid())
);

create or replace function public.minor_ai_allowed(p_calendar uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    not exists (select 1 from public.managed_profiles p where p.calendar_id = p_calendar and p.status = 'active')
    or (
      exists (select 1 from public.ai_legal_approvals a where a.calendar_id = p_calendar)
      and not exists (
        select 1 from public.managed_profiles p
        where p.calendar_id = p_calendar and p.status = 'active'
          and not exists (select 1 from public.declarations d where d.profile_id = p.id and 'ai' = any(d.functions))
      )
    )
$$;

revoke all on function public.minor_ai_allowed(uuid) from public;
grant execute on function public.minor_ai_allowed(uuid) to authenticated, service_role;

-- Owner adds a second adult by account e-mail. The added adult then signs with their own account name.
create or replace function public.add_guardian_by_email(p_profile uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_calendar uuid;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select p.calendar_id into v_calendar from public.managed_profiles p where p.id = p_profile;
  if v_calendar is null then raise exception 'profile_not_found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.calendars c where c.id = v_calendar and c.owner_id = v_uid) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  select u.id into v_target from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_target is null then raise exception 'account_not_found' using errcode = 'P0002'; end if;
  insert into public.profile_guardians (profile_id, user_id, role)
  values (p_profile, v_target, 'guardian')
  on conflict do nothing;
end $$;

revoke all on function public.add_guardian_by_email(uuid, text) from public;
grant execute on function public.add_guardian_by_email(uuid, text) to authenticated;
