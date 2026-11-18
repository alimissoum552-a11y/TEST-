-- 025: when a managed profile row is deleted, the minor's own sign-in account goes with it.
--
-- Found by the security audit (docs/SECURITY_AUDIT.md): deleting an adult owner removed the calendars and their
-- managed profiles, but the minor's account (a technical e-mail and the first name in the user metadata) stayed behind.
-- The Edge function team-admin already deletes the minor's account when an owner removes a profile or a calendar;
-- this trigger covers every other path (deleting the owner's account, a manual clean-up, the 30-day purge of pending profiles).

create or replace function public.delete_minor_account_with_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if old.auth_user_id is not null then
    delete from auth.users where id = old.auth_user_id;
  end if;
  return old;
end $$;

revoke execute on function public.delete_minor_account_with_profile() from public, anon, authenticated;

drop trigger if exists managed_profiles_delete_minor_account on public.managed_profiles;
create trigger managed_profiles_delete_minor_account
  after delete on public.managed_profiles
  for each row execute function public.delete_minor_account_with_profile();
