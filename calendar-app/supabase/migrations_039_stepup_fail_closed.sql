-- 039: fail closed for anonymous callers.
--
-- stepup_valid() used to answer true when auth.uid() was null, because "no passkey" was read as
-- "no requirement". Anonymous callers were still stopped by the permissive policies, but a future
-- policy that allowed anon would have opened these tables. The check now refuses any caller
-- without an identity, before looking at passkeys.

create or replace function public.stepup_valid() returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when not public.stepup_required() then true
    else exists (
      select 1 from public.passkey_stepups s
      where s.user_id = auth.uid()
        and s.session_id = public.jwt_session_id()
        and s.expires_at > now()
    )
  end
$$;
revoke all on function public.stepup_valid() from public;
grant execute on function public.stepup_valid() to authenticated, service_role;
