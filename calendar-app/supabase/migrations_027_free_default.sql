-- 027: paid plans are on sale (docs/PRICING.md). New accounts start on the free plan (no AI).
-- Accounts that existed before keep the launch plan (unlimited AI) until they are told otherwise in writing.
create or replace function public.default_plan()
returns text language sql immutable set search_path = public as $$ select 'free'::text $$;
