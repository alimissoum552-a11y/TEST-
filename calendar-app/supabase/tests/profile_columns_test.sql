-- Profile columns test (migration 031). Ends with an exception: nothing is kept. Every line must say "ok".
do $$
declare out text := ''; u uuid := gen_random_uuid(); v uuid := gen_random_uuid();
begin
  insert into auth.users(id, email, aud, role) values (u, 'pc-u@example.com', 'authenticated', 'authenticated'), (v, 'pc-v@example.com', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update profiles set display_name = 'New name', handle = 'pc_' || left(u::text, 6), avatar_url = null where id = u;
  out := out || 'own name, handle, avatar: ok | ';
  begin update profiles set email = 'pc-v@example.com' where id = u; out := out || 'own email: NOT BLOCKED | ';
  exception when insufficient_privilege then out := out || 'own email: ok | '; end;
  begin update profiles set account_type = 'adult' where id = u; out := out || 'own account type: NOT BLOCKED | ';
  exception when insufficient_privilege then out := out || 'own account type: ok | '; end;
  begin delete from profiles where id = u; out := out || 'delete own profile: NOT BLOCKED | ';
  exception when insufficient_privilege then out := out || 'delete own profile: ok | '; end;
  reset role;
  out := out || format('name saved: %s', case when (select display_name from profiles where id = u) = 'New name' then 'ok' else 'WRONG' end);
  raise exception 'RESULTS: %', out;
end $$;
