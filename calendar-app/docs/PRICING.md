# Plans and pricing

**Status on 19 November 2026: paid plans are on sale, live.** Stripe sells them as merchant of record (Managed Payments). New accounts start on the free plan (no AI); the nine accounts created before keep the `launch` plan (unlimited AI) until they are told otherwise in writing. This file is the reference for what is built and what is left.

## What is live

- Pricing page `#/pricing`, linked from the landing page (header and footer) and from the profile; its payment buttons open Stripe Checkout (`VITE_BILLING_OPEN=true` in Vercel).
- `billing` function in live mode (`BILLING_MODE=live`); webhooks from both modes are accepted and verified.
- Profile, "My plan": plan, status, renewal date, AI meter, "Manage my subscription" (Stripe portal).
- The AI refuses with a clear message and a "See the plans" link when the plan has no AI or the month's quota is used up (not shown to minors).
- New accounts: `default_plan()` = `free` (migration 027).
- Deleting an account cancels its Stripe subscription first (tested: a test-mode subscription was canceled when its account was deleted).
- Terms section 12 "Subscriptions and payment" and privacy section 16 "Payments" (six languages, dated 19 November 2026). Drafts: to be reviewed by a lawyer.

## Cancellation, refund and downgrade (19 November 2026)

- **Cancel**: from "Manage my subscription" (Stripe portal), at the end of the paid period. The profile then shows "Ends on <date>" instead of "Renews on". No refund is made by a cancellation.
- **Refund**: the profile shows "Refund possible until <date>" and a "Refund and stop my subscription" button during the first 14 days (30 for the work plan), as the terms promise. It refunds the subscription's payments in Stripe and ends it at once (`billing` action `refund`, migration 028). After the window the server refuses (`refund_window_passed`). Outside the app, refunds are made in the Stripe dashboard (Payments > the payment > Refund).
- **Downgrade**: when a subscription ends (end of period, immediate cancellation or refund), the webhook puts the account back on the plan it had before its first payment: `launch` for the accounts created before 19 November, `free` otherwise. A paid plan is never restored by mistake. The portal link stays for invoices.
- Tested with temporary accounts and test subscriptions (live mode on): a launch account subscribes (`plan_before_stripe = launch`), schedules the cancellation (end date shown), refunds from the profile (3 EUR refunded, back to launch); a free account goes back to free when the subscription ends; a refund after the window is refused. The owner's own live test purchase (3 EUR, 18 November) was refunded and his account put back on launch.

## Still to do

1. **One real purchase** (Starter monthly, 3 EUR) to check the live card payment and the live webhook end to end, then refund and cancel it in the Stripe dashboard. Not done: the live payment page cannot be driven by a script.
2. In the Stripe dashboard, check that the customer portal lets subscribers switch between the four Collyo products (the API does not echo the list back).
3. ~~Plan limits~~ — done 18 November 2026 (migration 030): the database refuses a shared calendar beyond the plan (Free and Starter: 1 since migration 033, Pro: 1, Team groups: 10), a member or invitation beyond the plan (Free and Starter: 5 since migration 033, Pro: 20, Team groups: 50 per calendar, invitations pending included), and turning on the team well-being analysis outside Team (work) and the launch plan; the hourly analysis skips calendars whose owner's plan no longer includes it. Nothing already there is removed after a downgrade: the limit only stops adding more. The app explains the refusal with a link to the plans. Test: `supabase/tests/plan_limits_test.sql` (rolled back; every line must say ok).
4. ~~Education~~ — done 18 November 2026 (migration 032, function `education`): see "Education" below.
5. Telling the nine launch accounts, in writing and with notice, when they move to the grid.
6. Legal review of the terms and privacy sections on payment.

Decisions taken on 18 November 2026 follow.

## Principles

1. **The creator pays, the people they invite never pay.** A family, a club or a class costs one subscription, not one per member.
2. **The AI follows the calendar, not the person.** A request made in a team calendar is counted on the owner's plan (`ai_usage.billed_to`), whoever asks, minors included. A request to the personal assistant is counted on the caller. A member on the free plan can therefore use the AI in a calendar whose owner has a plan with AI.
3. **Safety is never paid.** Guardian consent, minors' protections, account deletion and the data export are in every plan.
4. **No hidden charge.** Hard monthly quota, a clear message at the limit, no overage billed. A pack of 100 requests (about 2 EUR) may be added later.
5. **Work teams get no trial.** The free plan lets them try everything except the AI; monthly plans are cancellable at any time and a 30-day refund is announced. Work prices are shown excluding VAT, with an invoice and a VAT number.

## The grid

| Plan | Price | Content |
|---|---|---|
| Free | 0 | Personal calendar, **1 shared calendar with up to 5 members** (since 18 November 2026, migration 033, so invited families and small groups can try Collyo together), join any team calendar as a member, chat, e-mail reminders. **No AI.** |
| Starter | 3 EUR / month, 29 EUR / year, VAT incl. | Free (including its shared calendar of 5) + personal AI assistant (50 requests / month), personal well-being, connector. |
| Pro | 7 EUR / month, 69 EUR / year, VAT incl. | Starter + 1 shared calendar (family, club, class or small team, 20 members), minors, verified creator, 150 requests / month for the person and their calendar. |
| Team, groups | 15 EUR / month, 149 EUR / year, VAT incl. | Families, clubs, classes: 10 shared calendars of 50 members, 400 requests / month shared. |
| Team, work | 9 EUR / seat / month, 90 EUR / seat / year, excl. VAT, 3 seats minimum | Roles, team well-being analysis, 300 requests per seat pooled, priority support. |
| Education | 50 % off Pro and Team (groups) | Verified teachers. Schools: quote. |

Yearly prices are two months free. The numbers live in the `plans` table (migration 026) and the pricing page reads them from there; the text is in `src/pricing.js`.

## Unit economics (estimate, to be re-measured)

- One AI request costs about **0.008 USD** on Sonnet 5.5 (2 / 10 USD per million tokens), measured on the first 36 requests (2,560 input and 273 output tokens on average). Haiku 5.5 (0.10 / 0.50 USD) is about 20 times cheaper: route the simple requests ("find a free hour") to it to cut the AI bill.
- Stripe Identity: about 1.50 USD per verified creator, once (check the country rates in the Stripe dashboard).
- Stripe fees on cards: about 1.5 % + 0.25 EUR in Europe.
- With every quota used to the last request, the margin stays around 70 % of the price excluding VAT for every plan, before fixed costs. A typical use (30 % of the quota) gives 80 % or more.
- Fixed costs (Supabase, e-mail, domain): about 50 to 80 EUR a month, to be read on the invoices. The break-even is roughly 20 to 25 Pro or Starter subscribers.

Competitors seen: TimeTree Premium 4.49 USD / month or 44.99 USD / year with a free tier; Cozi Gold around 39 USD / year (sources disagree).

## What is built (migration 026, the AI functions, the pricing page)

- Tables `plans` (public read) and `subscriptions` (each user reads their own row; only the server writes). A new account gets `default_plan()` = `launch`; every existing account was moved to it.
- `ai_usage.billed_to` and `calendar_id`; `_shared/plans.ts` decides, on the server, whether a request may be made this month: no AI on a plan without it or with a canceled subscription, a monthly limit (multiplied by the seats for a per-seat plan), `past_due` keeps working (grace). Errors `plan_required` (403) and `quota_reached` (429), shown in six languages.
- Both AI functions (`chat-ai`, `assistant`) apply it. Tested on production with temporary accounts: launch works, a member's request is billed to the owner, the free plan is refused for everyone in the owner's calendar and for the personal assistant, a Starter account stops at 50, a Pro account continues, a member cannot read others' subscriptions nor change their own plan.
- Pricing page at `#/pricing` (six languages), a preview that says nothing is charged. **It is not linked from the site yet**: link it from the landing page when the prices are final.
- Unit tests: `supabase/functions/_shared/plans.test.ts` (decision), `src/content.test.js` (the six languages stay aligned).

## Stripe Billing, in test mode (built 18 November 2026)

- Setup script `scripts/stripe-billing-setup.mjs` (run with the test key; it reads the `plans` table): creates the products (with a SaaS tax code), the eight prices with lookup keys `<plan>_<month|year>`, the coupon `edu_50` (50 % off, for the education promotion code), the customer-portal configuration (cancel at period end, change plan or seats with proration, card, invoices) and the webhook endpoint on the `billing` function. It stores the webhook secret itself and never prints a secret. Run it again with the live key at launch.
- Function `billing` (deployed without JWT verification; user actions check the session): `checkout` (plan, interval, seats for the work plan, 3 minimum), `portal`, and the webhook. The webhook reads the subscription again from Stripe, so events in any order give the right state, and writes `subscriptions` (plan, status, seats, period end, Stripe ids, `source = stripe`). One subscription per account: a second checkout answers `already_subscribed` (409) and changing plan goes through the portal. A canceled subscription means no AI. Minors cannot subscribe.
- Secrets: `STRIPE_BILLING_API_KEY` (the test key now) and `STRIPE_BILLING_WEBHOOK_SECRET`. The live key of the identity verification (`STRIPE_API_KEY`) is untouched.
- Tested on production with temporary accounts and the Stripe test account: refusals (no token 401, unknown plan 400, too few seats 400, forged webhook signature 400), a Checkout session is created, a card subscription written by the webhook (`pro`, active, period end), the second checkout refused, a portal session created, an upgrade to the work plan with 4 seats followed, a cancellation followed, and the assistant is then refused (`plan_required`). Unit tests: `supabase/functions/_shared/billing.test.ts`.
- **Not tested: paying on the hosted Stripe page.** Stripe's page blocks scripted browsers, so the card form must be tested once by hand in a normal browser (test card 4242 4242 4242 4242, any future date, any CVC), after creating a Checkout session from the app or the function.
- **App side (built, dark by default):** the profile has a "My plan" section (plan, status, renewal date, AI requests used this month against the limit, a link to all plans and, for a paying account, "Manage my subscription" which opens the Stripe portal). It is visible to everyone and today shows the launch plan with the request count. After a payment, Stripe returns to `#/billing?status=success`, which opens the profile and checks every 3 seconds (8 times at most) until the webhook has written the subscription.
- **Pricing page buttons** are wired (signed out: create an account first; signed in: Stripe Checkout; already subscribed: the portal; seats field for the work plan, 3 minimum) but **disabled unless the build has `VITE_BILLING_OPEN=true`**, so production still shows "Coming soon". Tested with a build that has the flag on, a temporary account and the Stripe test account: the buttons, the plan section before and after a (API-created) subscription, the meter (3 / 150), the portal link and the return page.

### Live Stripe is configured (19 November 2026), but not switched on

The script was run with the live key (`rk_live_...`, restricted, same account "Collyo App", charges and payouts enabled). Created on the live account: the four products with their SaaS tax codes (personal use for consumer plans, business use for the work plan), the eight prices (`<plan>_<month|year>`, in euros, tax inclusive for consumers and exclusive for the work plan), the coupon `edu_50`, the customer-portal configuration and a webhook endpoint on the `billing` function (6 events). The identity webhook is untouched.

Test and live live side by side in the `billing` function: `BILLING_MODE` (a Supabase secret, **unset = test**) decides which Stripe mode the app's checkout and portal use; webhooks are verified with the secret of the mode they come from. Secrets: `STRIPE_BILLING_API_KEY` / `STRIPE_BILLING_WEBHOOK_SECRET` (test) and `STRIPE_BILLING_LIVE_API_KEY` / `STRIPE_BILLING_LIVE_WEBHOOK_SECRET` (live). Checked on the live account without charging anyone: a Checkout session created with the same options as the app (Collyo is the seller, euros, Stripe Tax on, VAT numbers accepted) and then expired; its test customer was deleted.

**To open sales:** (1) do the manual card test in test mode; (2) set the Stripe Tax registrations (see below); (3) set the Supabase secret `BILLING_MODE=live`; (4) move the accounts from the launch plan to the grid; (5) set `VITE_BILLING_OPEN=true` in Vercel and redeploy.

Found while configuring the live account:
- **No tax registration is set in Stripe Tax.** Until the Portuguese VAT registration (and the EU one-stop shop for sales to consumers in other EU countries) is added in the dashboard (Tax > Registrations), Stripe Tax collects no VAT on Collyo's sales. Do this before step (3); the prices for consumers are VAT-inclusive.
- **Plan switching in the portal**: the plan list was sent to Stripe for both modes, but the API does not echo it back. Open Settings > Billing > Customer portal in the dashboard and check that "Customers can switch plans" lists the four Collyo products; if not, add them there.
- Managed Payments is still on at account level; the app turns it off on each session. Turn it off in the dashboard too.

### Who sells: Stripe, with Managed Payments (decided 19 November 2026; replaces the 18 November decision below)

The owner chose to keep **Managed Payments**: Stripe (Link) is the merchant of record, handles VAT and is named on the payment page; Collyo is the provider. The `billing` function no longer turns it off, adaptive pricing is on (local currency on the payment page). No Stripe Tax registration is needed for the sales Stripe makes as merchant of record. The pricing page says so in six languages. The terms must still say who sells and how to cancel.

**Live since 19 November 2026:** `BILLING_MODE=live` (Supabase secret) and `VITE_BILLING_OPEN=true` (Vercel). Checked with a temporary account: the app creates a live Checkout session (`cs_live_`, Managed Payments on, 3 EUR for Starter) and a live portal session; the session was expired and the live customer deleted. **Not checked: a real card payment and the live webhook**, which need a real purchase (buy Starter, check the profile shows it, then refund and cancel in the dashboard). Existing accounts stay on the launch plan (unlimited AI); new accounts too, until `default_plan()` is switched to `free`.

### Earlier decision: Collyo sells (18 November 2026, reversed)

The Stripe account has **Managed Payments** on by default: Stripe's entity ("Onelink") becomes the merchant of record, the buyer sees "Sold through Onelink", Collyo only appears as the provider, prices are converted to the buyer's currency, and Stripe adds about 3.5 % per transaction (Stripe's marketing page; check the dashboard). **Decision: Collyo sells, in its own name.** Every Checkout session sent by the `billing` function therefore passes `managed_payments[enabled]=false` and `adaptive_pricing[enabled]=false` (prices charged in euros, as on the pricing page). Checked on test sessions: `managed_payments = false`, currency EUR, Stripe Tax on, VAT numbers accepted.

Consequences, to settle before launch (with an accountant):
- **VAT is Collyo's job.** The account is based in Portugal and Stripe Tax is active (head office PT). Register for Portuguese VAT and, for sales to consumers in other EU countries, the EU one-stop shop (OSS); add the registrations in Stripe Tax so it collects the right rate. Prices for consumers are VAT-inclusive; the work plan is excl. VAT with VAT-number entry (reverse charge for EU businesses).
- **Invoices come from Collyo**: fill in the legal name, address, VAT number and invoice footer in the Stripe dashboard (Settings > Business > Invoices) and the checkout branding. The terms must name the seller.
- **Turn Managed Payments off in the dashboard** as well (Settings > Payments), so that no other flow (payment links, a future change) uses it by mistake. The per-session setting is enough for the app.
- Selling outside the EU (United States sales tax, United Kingdom VAT) adds registrations; start with the EU and decide later.


## Education (built 18 November 2026)

- **Request**: on the pricing page, a signed-in adult gives the school, their address at the school and the country. Personal mailboxes (Gmail, Outlook, Orange...) are refused. A link valid 7 days goes to the school address (one new link per 10 minutes at most).
- **Confirmation**: the link (`#/education?token=...`, works once) confirms the address. Known school domains (`.edu`, `.edu.xx`, `.ac.xx`, `ac-*.fr`, `.sch.uk`, `k12.*.us`, `educa.*`, `schule.*`, `min-edu.pt`) are approved at once; any other domain goes to a manual check, which the monitoring digest reports.
- **Price**: an approved account gets the coupon `edu_50` (50 %) applied directly at checkout for Pro and Team (groups); nothing to type. Starter and Team (work) are not covered. Schools: by quote, as before.
- **Tested** with temporary accounts: refusals (no session, personal mailbox, a second request at once, bad or reused link, decision without the support secret), confirmation to review then approval by support, automatic approval for `ac-lyon.fr`, and a live Pro checkout at 3.50 EUR instead of 7 EUR (session expired, test customer deleted); in the browser, the form, its messages and the confirmation page.

## Admin accounts (18 November 2026)

The founder's accounts (`ADMIN_USER_IDS`, today two) can switch their own plan without payment, to test what each plan gives: on the pricing page every card shows "Switch without payment (admin)" instead of the Stripe button, and a bar offers "Back to the launch plan (everything included)". Server side: `billing` action `admin_set_plan` (refused with 403 for any other account; plans `launch`, `free`, `starter`, `pro`, `team_groups`, `team_work`; `source = manual`, 3 seats for the work plan); nothing is sent to Stripe. If the account has a running paid subscription, it must be canceled first (`stripe_subscription_active`). Tested: refused for an ordinary account, switch to Team (work) then Pro then back to launch through the real page, admin list restored.
