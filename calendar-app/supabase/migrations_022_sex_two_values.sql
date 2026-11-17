-- The sex of a managed profile stays optional, and only two values are kept: female and male ("other" is removed).
-- No row uses "other" (checked before writing this file). If one existed, adding the constraint would fail instead of
-- silently deleting what the adult entered.
alter table public.managed_profiles drop constraint if exists managed_profiles_sex_check;
alter table public.managed_profiles add constraint managed_profiles_sex_check
  check (sex is null or sex in ('female', 'male'));
