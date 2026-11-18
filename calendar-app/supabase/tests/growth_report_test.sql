-- Growth report test (migration 034). Rolled back. Expected: 3 new people, 2 activated (one owner who shared, one who joined).
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); cal uuid; r jsonb; w jsonb;
begin
  insert into auth.users(id, email, aud, role) values (a, 'gr-a@example.com', 'authenticated', 'authenticated'), (b, 'gr-b@example.com', 'authenticated', 'authenticated'), (c, 'gr-c@example.com', 'authenticated', 'authenticated');
  insert into calendars(owner_id, name) values (a, 'Club') returning id into cal;           -- a creates a shared calendar
  insert into calendar_members(calendar_id, user_id, role) values (cal, b, 'reader');        -- b joins it
  insert into events(calendar_id, owner_id, title, starts_at, ends_at) values (cal, a, 'Training', now(), now() + interval '1 hour');
  insert into events(calendar_id, owner_id, title, starts_at, ends_at)
    select id, b, 'Dentist', now(), now() + interval '1 hour' from calendars where owner_id = b and is_default;  -- b makes an event
  -- c signs up and does nothing
  r := public.growth_report(2);
  select x into w from jsonb_array_elements(r->'weeks') x order by x->>'week' desc limit 1;
  raise exception 'RESULT signups=% activated=% (expected: +3 signups, +2 activated)', w->>'signups', w->>'activated';
end $$;
