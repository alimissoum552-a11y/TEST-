-- 028: what happens when a paid subscription ends, and self-service refunds (docs/PRICING.md).
-- plan_before_stripe: the plan the account had before its first payment (launch or free), restored when the
--   subscription ends. cancel_at: the date a scheduled cancellation takes effect. started_at: when the paid
--   subscription started, to know whether the refund window (14 days, 30 for work teams) is still open.
alter table public.subscriptions add column if not exists plan_before_stripe text references public.plans(code);
alter table public.subscriptions add column if not exists cancel_at timestamptz;
alter table public.subscriptions add column if not exists started_at timestamptz;
