-- Signing a declaration compared the typed name with the verified name word for word. Stripe can return the
-- first and last name in the other order, and with accents or capitals. The comparison now ignores order,
-- accents and case, and two clearer errors tell the user what is missing.

create or replace function public.name_key(v text) returns text
language sql immutable as $$
  select coalesce(string_agg(t, ' ' order by t), '')
  from unnest(regexp_split_to_array(
    translate(lower(trim(coalesce(v, ''))), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
    '\s+'
  )) as t
  where t <> ''
$$;

create or replace function public.sign_managed_profile(
  p_profile uuid, p_first text, p_last text, p_functions text[], p_version text
) returns public.managed_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.managed_profiles;
  v_calendar public.calendars;
  v_typed text := public.name_key(p_first || ' ' || p_last);
  v_expected text;
  v_is_owner boolean;
  v_verified boolean;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;

  select * into v_profile from public.managed_profiles where id = p_profile for update;
  if not found then raise exception 'profile_not_found' using errcode = 'P0002'; end if;
  if v_profile.status <> 'pending' then raise exception 'profile_not_pending'; end if;

  select * into v_calendar from public.calendars where id = v_profile.calendar_id;
  v_is_owner := v_calendar.owner_id = v_uid;
  if not v_is_owner and not exists (
    select 1 from public.profile_guardians g where g.profile_id = p_profile and g.user_id = v_uid
  ) then
    raise exception 'not_an_adult_responsible' using errcode = '42501';
  end if;

  if v_is_owner then
    select (v.status = 'verified'), public.name_key(v.verified_name) into v_verified, v_expected
    from public.identity_verifications v where v.user_id = v_uid;
    if not coalesce(v_verified, false) then raise exception 'creator_not_verified' using errcode = '42501'; end if;
    -- Verified, but Stripe's name has not been read yet: the app refreshes it, then the user signs again.
    if coalesce(v_expected, '') = '' then raise exception 'identity_name_missing' using errcode = '42501'; end if;
  else
    select public.name_key(p.display_name) into v_expected from public.profiles p where p.id = v_uid;
    if coalesce(v_expected, '') = '' then raise exception 'account_name_missing' using errcode = '42501'; end if;
  end if;

  if v_typed = '' or v_typed <> v_expected then
    raise exception 'name_mismatch' using errcode = '22023';
  end if;

  if v_profile.sex is not null and not ('sex' = any(coalesce(p_functions, '{}'))) then
    raise exception 'declaration_missing_sex' using errcode = '22023';
  end if;

  insert into public.declarations (profile_id, signer_id, typed_name, name_matches, text_version, functions)
  values (p_profile, v_uid, trim(p_first) || ' ' || trim(p_last), true, p_version, coalesce(p_functions, '{}'));

  if v_is_owner then
    insert into public.profile_guardians (profile_id, user_id, role) values (p_profile, v_uid, 'manager')
    on conflict do nothing;
  end if;

  update public.managed_profiles set status = 'active', activated_at = now()
  where id = p_profile returning * into v_profile;
  return v_profile;
end $$;

revoke all on function public.sign_managed_profile(uuid, text, text, text[], text) from public;
grant execute on function public.sign_managed_profile(uuid, text, text, text[], text) to authenticated;
