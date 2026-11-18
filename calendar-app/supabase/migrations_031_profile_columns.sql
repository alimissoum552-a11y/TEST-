-- 031: what a signed-in user may change in their own profile row (security audit, 18 November 2026).
-- Before: every column was writable through the API, including `email` (used to find people by address and for passkey
-- sign-in) and `account_type` (adult or minor), and the row could be deleted outside the account deletion flow.
-- Now: only the columns the app edits; the rest is written by the server (triggers, service role).
revoke insert, update, delete on public.profiles from authenticated, anon;
grant update (display_name, avatar_url, handle, ai_accepted_at, timezone) on public.profiles to authenticated;
