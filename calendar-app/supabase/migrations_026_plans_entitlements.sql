-- 026: plans, subscriptions and per-owner AI metering (docs/PRICING.md). Nothing is charged yet.
--
-- Until billing opens, every account is on the "launch" plan, which behaves like the app does today
-- (AI allowed, only the daily safety cap). Switching to the real grid is a data change: set
-- default_plan() to 'free' and move accounts to their plan.
--
-- The AI follows the calendar, not the person: a request made in a team calendar is counted on the
-- calendar owner's plan (billed_to); a request to the personal assistant is counted on the caller.

create table if not exists public.plans (
  code text primary key,
  name text not null,
  audience text not null check (audience in ('everyone', 'personal', 'groups', 'work', 'launch')),
  ai_enabled boolean not null,
  ai_monthly_requests integer,            -- null = no monthly limit
  ai_per_seat boolean not null default false,
  max_shared_calendars integer,           -- null = unlimited. Not enforced yet.
  max_members_per_calendar integer,       -- null = unlimited. Not enforced yet.
  min_seats integer not null default 1,
  price_month_cents integer not null default 0,
  price_year_cents integer not null default 0,
  price_includes_tax boolean not null default true,   -- consumers: tax included. Work teams: excluded.
  sort integer not null default 0
);

insert into public.plans (code, name, audience, ai_enabled, ai_monthly_requests, ai_per_seat, max_shared_calendars, max_members_per_calendar, min_seats, price_month_cents, price_year_cents, price_includes_tax, sort) values
  ('free',        'Free',            'everyone', false, 0,    false, 0,    null, 1, 0,    0,     true,  1),
  ('starter',     'Starter',         'personal', true,  50,   false, 0,    null, 1, 300,  2900,  true,  2),
  ('pro',         'Pro',             'groups',   true,  150,  false, 1,    20,   1, 700,  6900,  true,  3),
  ('team_groups', 'Team (groups)',   'groups',   true,  400,  false, 10,   50,   1, 1500, 14900, true,  4),
  ('team_work',   'Team (work)',     'work',     true,  300,  true,  null, null, 3, 900,  9000,  false, 5),
  ('launch',      'Launch (free)',   'launch',   true,  null, false, null, null, 1, 0,    0,     true,  0)
on conflict (code) do nothing;

create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_code text not null references public.plans(code),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  source text not null default 'launch' check (source in ('launch', 'stripe', 'manual')),
  seats integer not null default 1 check (seats >= 1),
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

-- Plans are public (the pricing page). A subscription is private to its owner and only the server writes it.
drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans for select using (true);
drop policy if exists subscriptions_own_read on public.subscriptions;
create policy subscriptions_own_read on public.subscriptions for select to authenticated using (user_id = auth.uid());

-- The plan new accounts get. 'launch' while billing is closed.
create or replace function public.default_plan()
returns text language sql immutable set search_path = public as $$ select 'launch'::text $$;

create or replace function public.create_default_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id, plan_code, source) values (new.id, public.default_plan(), 'launch')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists profiles_default_subscription on public.profiles;
create trigger profiles_default_subscription after insert on public.profiles
  for each row execute function public.create_default_subscription();

revoke execute on function public.create_default_subscription() from public, anon, authenticated;
grant execute on function public.default_plan() to anon, authenticated;

-- Everyone who exists today.
insert into public.subscriptions (user_id, plan_code, source)
select p.id, public.default_plan(), 'launch' from public.profiles p
on conflict (user_id) do nothing;

-- AI metering: who pays for the request, and in which calendar it was made.
alter table public.ai_usage add column if not exists billed_to uuid references public.profiles(id) on delete set null;
alter table public.ai_usage add column if not exists calendar_id uuid references public.calendars(id) on delete set null;
update public.ai_usage set billed_to = user_id where billed_to is null;
create index if not exists ai_usage_billed_month_idx on public.ai_usage (billed_to, created_at);

drop policy if exists ai_usage_billed_read on public.ai_usage;
create policy ai_usage_billed_read on public.ai_usage for select to authenticated using (billed_to = auth.uid());
