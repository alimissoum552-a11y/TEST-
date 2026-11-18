-- 033: the free plan can share (growth: an invited family or club must be able to try Collyo together).
-- Free and Starter: 1 shared calendar with up to 5 members (invitations pending included). Still no AI on Free.
update public.plans set max_shared_calendars = 1, max_members_per_calendar = 5 where code in ('free', 'starter');
