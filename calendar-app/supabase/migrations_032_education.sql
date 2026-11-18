-- 032: education price (docs/PRICING.md, "Education"). One request per account.
-- The teacher gives a school address and confirms it by e-mail; known school domains are approved at once, the others
-- wait for a manual check. Approved: the education coupon (50 %) is applied at checkout to Pro and Team (groups).
create table if not exists public.education_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  school_name text not null,
  school_email text not null,
  country text,
  status text not null default 'email_sent' check (status in ('email_sent', 'review', 'approved', 'rejected')),
  token_hash text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  decided_at timestamptz,
  note text
);
alter table public.education_requests enable row level security;
drop policy if exists education_own_read on public.education_requests;
create policy education_own_read on public.education_requests for select to authenticated using (user_id = auth.uid());
-- Written only by the `education` function (service role).
revoke insert, update, delete on public.education_requests from authenticated, anon;
