# Plans and pricing

Decisions taken on 18 November 2026. **Nothing is charged yet.** Every account is on the `launch` plan, which behaves like the app does today. This file is the reference for what is built, what is announced and what is still missing.

## Principles

1. **The creator pays, the people they invite never pay.** A family, a club or a class costs one subscription, not one per member.
2. **The AI follows the calendar, not the person.** A request made in a team calendar is counted on the owner's plan (`ai_usage.billed_to`), whoever asks, minors included. A request to the personal assistant is counted on the caller. A member on the free plan can therefore use the AI in a calendar whose owner has a plan with AI.
3. **Safety is never paid.** Guardian consent, minors' protections, account deletion and the data export are in every plan.
4. **No hidden charge.** Hard monthly quota, a clear message at the limit, no overage billed. A pack of 100 requests (about 2 EUR) may be added later.
5. **Work teams get no trial.** The free plan lets them try everything except the AI; monthly plans are cancellable at any time and a 30-day refund is announced. Work prices are shown excluding VAT, with an invoice and a VAT number.

## The grid

| Plan | Price | Content |
|---|---|---|
| Free | 0 | Personal calendar, join any team calendar as a member, chat, e-mail reminders. **No AI.** |
| Starter | 3 EUR / month, 29 EUR / year, VAT incl. | Free + personal AI assistant (50 requests / month), personal well-being, connector. |
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
- The pricing page buttons still say "Coming soon": `startCheckout` and `openBillingPortal` exist in `src/lib/api.js` and are not wired.

### Who sells: Collyo (decided 18 November 2026)

The Stripe account has **Managed Payments** on by default: Stripe's entity ("Onelink") becomes the merchant of record, the buyer sees "Sold through Onelink", Collyo only appears as the provider, prices are converted to the buyer's currency, and Stripe adds about 3.5 % per transaction (Stripe's marketing page; check the dashboard). **Decision: Collyo sells, in its own name.** Every Checkout session sent by the `billing` function therefore passes `managed_payments[enabled]=false` and `adaptive_pricing[enabled]=false` (prices charged in euros, as on the pricing page). Checked on test sessions: `managed_payments = false`, currency EUR, Stripe Tax on, VAT numbers accepted.

Consequences, to settle before launch (with an accountant):
- **VAT is Collyo's job.** The account is based in Portugal and Stripe Tax is active (head office PT). Register for Portuguese VAT and, for sales to consumers in other EU countries, the EU one-stop shop (OSS); add the registrations in Stripe Tax so it collects the right rate. Prices for consumers are VAT-inclusive; the work plan is excl. VAT with VAT-number entry (reverse charge for EU businesses).
- **Invoices come from Collyo**: fill in the legal name, address, VAT number and invoice footer in the Stripe dashboard (Settings > Business > Invoices) and the checkout branding. The terms must name the seller.
- **Turn Managed Payments off in the dashboard** as well (Settings > Payments), so that no other flow (payment links, a future change) uses it by mistake. The per-session setting is enough for the app.
- Selling outside the EU (United States sales tax, United Kingdom VAT) adds registrations; start with the EU and decide later.

## What is still missing before anyone can pay

1. **A manual Checkout test** in a normal browser, then wiring the buttons (`startCheckout`, `openBillingPortal`) and a "my plan" section in the profile with the usage meter.
2. **Switching the grid on**: `default_plan()` returns `free`, accounts move from `launch` to their plan, with a notice period for the people already using the AI; create the live Stripe objects with the script and the live key; a live webhook endpoint; store the live key as `STRIPE_BILLING_API_KEY`.
3. **Limits other than the AI**: the number of shared calendars and members per calendar are stored in `plans` but **not enforced yet** (database triggers, to be tested carefully because personal and team calendars share one table). Team well-being analysis (`wellbeing-team`) is not metered or gated yet.
4. **Education**: Stripe Identity proves who a person is, not that they teach. Verify the teacher status with a school e-mail domain or a manual check of a document to start; then give the teacher a promotion code on the coupon `edu_50`. Schools need a contract and a data-processing agreement, and the AI for pupils stays off by default.
5. **Legal**: terms (price change and notice, refunds, 14-day withdrawal for consumers, cancellation, who the seller is under Managed Payments), privacy (payment processor), invoices. The pricing page wording must be reviewed with the terms.
6. **A usage meter** in the app ("42 / 150 requests this month") and the upgrade path in the message at the limit.
