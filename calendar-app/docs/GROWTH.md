# Growth

Plan decided on 18 November 2026, when Collyo had no user yet (the existing accounts are the founder's tests and his children).

## First audience: youth sports clubs

One coach brings 15 to 25 families, members never pay, and the problem is daily (WhatsApp groups, schedule changes, missed information). What Collyo does differently matters most there: verified creator, protected minors, signed declarations, an AI that finds a free slot for everyone. Families follow (a parent who meets Collyo through the club uses it at home); school classes come third, with the education price.

**First step, done by the founder:** contact about 30 local clubs (football, basketball, swimming, dance), offer the "founding club" deal below in exchange for feedback, and set each club up in person (create the calendar with the coach, invite the parents together). Goal: 5 active clubs in 4 weeks.

## What the product does for growth

- **Free plan can share** (migration 033): 1 shared calendar with up to 5 members, still without AI, so an invited family or a small group can try Collyo together. Starter has the same sharing plus the AI.
- **Founding club deal**: Team (groups) free for 6 months, one code per club, single use, valid 60 days. Make a code with
  `STRIPE_BILLING_API_KEY=<live key> node scripts/founder-code.mjs "Club name"` and send it to the club; they enter it on the Stripe payment page ("Add promotion code"). The coupon `founder_club_6m` (100 %, 6 months) only applies to Team (groups) (checked: Team groups goes to 0 EUR, Pro refuses the code). After 6 months the normal price applies unless the club cancels.
- **Education price** for teachers (see docs/PRICING.md).

## Measuring, without cookies

`growth_report()` (migration 034) reads the app's own data; no cookie or tracker is added, which keeps the landing page promise. It counts adults and leaves out the accounts still on the launch plan (the founder's tests).

| Number | Meaning |
|---|---|
| sign-ups | accounts created in the week |
| activated | within 7 days, made an event **and** shared (owns a calendar with a member or a pending invitation, or joined someone else's calendar) |
| came back | did something (event or message) or signed in between day 7 and day 14 |
| active 7 days | made an event or a message, or signed in, in the last 7 days |
| shared calendars 3+ | calendars with the owner and at least 2 members |
| paying, revenue | Stripe subscriptions by plan, monthly revenue at list price (before coupons) |

A digest is e-mailed every Monday at 07:00 UTC to `OPS_ALERT_TO` (function `growth-report`, `supabase/growth_cron.sql`). Ad hoc: `select public.growth_report(8);` in the SQL editor. Test: `supabase/tests/growth_report_test.sql` (rolled back).

**Goals for the first two months:** activated / sign-ups above 40 %, came back above 30 %, 5 clubs with 10 or more members. If activation is low, fix onboarding before spending on anything else.

## Next steps (not done yet)

1. Pages per use case that Google can index (real paths and pre-rendering; the `#/` routes are not indexed separately), in French, Portuguese and Spanish first.
2. A prospecting kit: e-mail to clubs, a one-page leaflet, a short demo video script.
3. Referral: one month offered to whoever invites someone who then creates their own group.
4. A "How did you hear about Collyo?" question at sign-up, to know which channel works.
5. Paid ads (Meta, parents of one region) only once activation works.
