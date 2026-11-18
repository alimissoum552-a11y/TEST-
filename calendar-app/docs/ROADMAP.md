# Development roadmap

Steps are numbered `S1`, `S2`, ... and are meant to be closed **in order**.
Each step has a `Done when` criterion that can be checked, not a vague goal.

Status: `[x]` shipped, `[~]` in progress, `[ ]` planned, `[!]` blocked.

---

## Current state (verified against the code and the database)

Database tables: `profiles`, `calendars` (with `kind`), `events`, `calendar_members`, `calendar_invites`, `event_history`,
`messages`, `chat_ai_notes`, `ai_usage`, `ai_permissions`, `notifications`, `webauthn_credentials`, `wellbeing_settings`,
`wellbeing_checkins`, `team_wellbeing`, `team_wellbeing_optout`, `wellbeing_alerts`, `wellbeing_analysis_log`,
`identity_verifications`, `managed_profiles`, `profile_guardians`, `declarations`, `ai_legal_approvals`.
Storage bucket: `avatars`. Migrations 001 to 018 are applied in production.
Edge functions: `send-invite`, `send-reminders` (cron), `assistant`, `chat-ai`, `mcp`, `webauthn`, `wellbeing-team` (cron),
`identity` (Stripe).
See `docs/OPERATIONS.md` for deploy and secrets, and `docs/AI.md` for the AI rules.

### Shipped

- [x] React + Vite + Tailwind front end, responsive mobile / tablet / desktop
- [x] Monochrome design, header reduced to avatar + menu
- [x] Supabase project with RLS on every table
- [x] Email / password auth; profile and default calendar created by trigger
- [x] i18n: EN, FR, ES, DE, AR (RTL), PT; dates via locale
- [x] Legal pages: Terms, Privacy, Cookie Policy, in 6 languages; AI and chat clauses added
- [x] Events: create, edit, delete; title, location, description, start/end, reminder (chosen at creation and edit)
- [x] Month view with navigation (previous, next, today), week list (Monday to Sunday), day view over 24 hours
- [x] Realtime updates of the event list
- [x] Reminder e-mails sent by a scheduled job (once per event, reset when the time changes)
- [x] Sharing with roles: owner, administrator, contributor, reader
- [x] Invitations: pending state, accept, decline, cancel, join link, e-mail
- [x] Invitation links: pending invitation kept in the browser; account mismatch offers sign-out; joined calendar selected
- [x] Team panel with roles; owner row; notice that availability is shared with the AI
- [x] Event history written by trigger; restore a previous version
- [x] User avatars: initial fallback, photo upload to per-user storage
- [x] Calendar selector: own calendars and those joined, with role and owner
- [x] Custom domain `collyo.app` verified in Resend; sender `invites@collyo.app`,
      reply-to `support@collyo.app`, routing `invites@` to the owner inbox
- [x] Deployment on Vercel (by CLI; automatic deploys blocked, see OPERATIONS)
- [x] AI assistant panel: personal, consent, shared availability only, daily cap; writes events only with the user's permissions
- [x] Deterministic free-slot search with unit tests (time zones, daylight saving)
- [x] Team chat per calendar: history, Realtime, online members, "is typing", @mentions, readers read-only
- [x] Team chat AI, switched on by the owner only: replies to @AI / @IA / @KI, keeps shared notes
- [x] Usage log per request (`ai_usage`) for pricing
- [x] Member handles (@pseudo) and a notification bell for mentions
- [x] Passkeys (WebAuthn) at sign-in, and password reset by e-mail
- [x] AI permissions per user (create, move, delete), off by default
- [x] MCP connector (read-only) with an OAuth consent page and revocation
- [x] Well-being mode: personal settings and check-ins, team analysis, private distress alerts, owner journal (`docs/WELLBEING.md`)
- [x] Family, sports team and class calendars: verified creator (Stripe Identity), managed minors, signed declaration, AI blocked
      for minors until approval (`docs/FAMILY_TEAM.md`)
- [x] Verified identity badge on the profile
- [x] Team calendars created from the menu (family, sports team, class), visible to their members only
- [x] Minor access: access ID, login with the owner's e-mail, reduced app (calendar read-only and chat), guardian consent by e-mail under 13 (`docs/MINOR_APP.md`)
- [x] Landing page with live demos in six languages, including well-being and the three group types
- [x] Landing page: sharing tags and image, a primary sign-up button in the hero, a "Who is it for?" section, a trust section and a short FAQ, in six languages
- [x] Brand identity: the "C" logo in the landing header, sign-in, minor login and consent pages, plus favicon, home-screen icon, web manifest and the sharing image

### Partly shipped (differs from the plan below)

- [~] **AI assistant (S13 to S17)**: an assistant and a chat AI are live; they write events only with the user's permission. Tasks, focus blocks, the solver
      and the proposal-and-confirm flow are not built. The chat AI and the assistant do not depend on S7 and S8
      (entitlements, metering); they are capped per day only. This was a deliberate choice; see `docs/AI.md`, section 8.
- [~] **S3. Reminders**: sent once by e-mail. Not yet in the user's time zone: the mail shows UTC.
- [~] **MCP connector (read-only, any AI client)**: OAuth server, consent page, four read-only tools, revocation in the profile.
      Built and tested with direct requests. Still to do: the end-to-end test inside claude.ai by the owner.

- [~] **Family, sports team and class modes**: live. Not built yet: the minor's own account and view (from the age of digital
      consent), a screen to record the legal approval of AI, the verified badge visible to other members. Stripe Identity runs
      with a live key while the legal review is still pending: close this gap.
- [~] **Minor access**: coded and tested locally, production pending approval. Not built yet: the switch to an adult account at 16. The owner can remove a member, remove a minor profile (its technical account is deleted too) and delete a team calendar (`team-admin`).
- [~] **Well-being**: live. Not built yet: automatic purge of check-ins, clinical validation of the distress rules.

### Corrections to the previous version of this file

Phase 1 items previously marked "todo" are in fact shipped: editing, realtime,
sharing with roles, activity log, restore. They are listed above and removed
from the backlog below.

---

## Phase 1: close the MVP (S1 - S6)

- [ ] **S1. All-day events.**
      The `all_day` column exists but no UI reads it.
      Add a toggle in create/edit, render all-day events above the timeline.
      *Done when*: an all-day event created in the UI survives a reload and
      renders without a time in month, day and events views.

- [ ] **S2. Recurring events.**
      The `repeat_rule` column exists, unused. Store an RRULE and expand it
      server-side (Edge Function) for a bounded window.
      *Done when*: a weekly event returns the expected occurrences for 8 weeks,
      and editing "this occurrence" vs "all" is defined and documented.

- [~] **S3. Reminders and notifications.** Reminder e-mails are sent by a
      scheduled job (pg_cron + Edge Function `send-reminders`), once per event.
      Still open: the user's time zone in the mail, and push notifications.
      *Done when*: a reminder fires within 1 minute of its target time, once
      only (idempotent), in the user's timezone.

- [ ] **S4. Optimistic concurrency.**
      No `version` column today; two edits silently overwrite each other.
      Add `version` to `events`, increment on write, require it on PATCH.
      *Done when*: a stale write is rejected and the UI offers to reload or
      overwrite, and a two-session test proves no silent loss.

- [ ] **S5. Author on live changes.**
      `event_history.actor_id` is recorded but not shown.
      Show the author's name and avatar in the activity list and in a live
      change notice.
      *Done when*: a change made by another member displays that member's name
      in the activity list.

- [ ] **S6. Automated permission tests.**
      Permissions were verified by hand several times; that must not regress.
      Script the matrix (owner / admin / contributor / reader / stranger) for
      events, members, invites, history, storage.
      *Done when*: one command runs the matrix against a test project and fails
      the build on any unexpected allow or deny.

---

## Phase 2: monetization foundation (S7 - S12)

Nothing here is billable today: there is no plan, no quota and no payment.
The pricing grid cannot be enforced before this phase is closed.

- [~] **S7. Entitlements model.** *Started 18 Nov 2026: tables and the AI quota are done, see `docs/PRICING.md`; calendar and member limits are not enforced yet.*
      Tables `plans`, `subscriptions`, `usage_counters`; one server-side
      function `can(user, action)` used by the API.
      *Done when*: every limited feature (seats, shared calendars, AI actions)
      asks `can()` and no limit is enforced in the client only.

- [~] **S8. Usage metering.** *AI requests are counted per month and per payer (`ai_usage.billed_to`); team well-being analysis is not metered yet.*
      Count AI actions per user per month, atomically, with an explicit
      definition of a billable "action".
      *Done when*: the counter matches the number of confirmed AI actions in
      a test session, including retries and failed calls being excluded.

- [ ] **S9. Stripe.**
      Checkout, customer portal, webhooks, subscription state sync.
      *Done when*: subscribe, upgrade, cancel and failed payment all update
      `subscriptions` within seconds, in test mode.

- [ ] **S10. Plan enforcement.**
      Seats, shared-calendar count and AI quota enforced server-side with a
      clear message at the limit; no silent failure.
      *Done when*: a user at quota is stopped with an explicit message and an
      upgrade path, and the API refuses the same call directly.

- [ ] **S11. Pricing page and trial.**
      Honest page: what exists today vs what is announced; TTC/HT and VAT
      stated. 14-day trial instead of a free tier.
      *Done when*: a new account gets exactly 14 days, then degrades to a
      read-only state without data loss.

- [ ] **S12. Billing legal.**
      Update Terms (price change, notice period, refunds, fair use) and
      Privacy (payment processor, AI provider if any).
      *Done when*: the pages list every processor actually used, with location.

---

## Phase 3: AI assistant (S13 - S19)

Originally planned to depend on S7 and S8. The assistant and the chat AI were
shipped before them, with a daily cap; prices are to be set from `ai_usage` later.
The LLM understands intent; it does **not** compute the schedule.

- [ ] **S13. Tasks and focus blocks.**
      Tables `tasks` (duration, deadline, priority) and `focus_blocks`
      (type, flexible/locked). Nothing can be planned before this exists.
      *Done when*: a user can create tasks and focus blocks, with RLS by role.

- [ ] **S14. Deterministic scheduler.**
      Constraint solver over working hours, existing events, focus blocks,
      deadlines and priority. No LLM.
      *Done when*: unit tests cover conflicts, empty weeks, overload, and the
      same input always produces the same plan.

- [ ] **S15. Server tools with user JWT.**
      Narrow tool set (`read_window`, `propose_slots`, `propose_event_change`,
      `invite_member`) executed server-side with the caller's token so RLS
      stays the only authority. No service-role key in the AI path.
      *Done when*: a tool call cannot read or write a calendar the caller
      cannot access, proven by a test.

- [ ] **S16. LLM gateway.**
      One internal interface, model chosen by environment variable, JSON
      schema validation with bounded retries, context window capped to
      ±2 weeks plus aggregates.
      *Done when*: switching provider is a config change, and invalid model
      output never reaches the database.

- [ ] **S17. Assistant UX and audit.**
      The assistant proposes a diff; the user confirms; then it applies.
      Every proposal is written to `assistant_actions`.
      *Done when*: no AI change reaches `events` without an explicit confirm,
      and each change is traceable to one proposal.

- [ ] **S18. Quotas wired to metering.**
      AI actions decrement `usage_counters`; graceful degradation to a smaller
      model at 80%, hard stop with upgrade path at 100%.
      *Done when*: quota behaviour matches the pricing page exactly.

- [ ] **S19. Evaluation harness.**
      30-50 real requests with expected outcomes; measure valid JSON on first
      try, correct tool, correct arguments, p50/p95 latency, cost per action.
      *Done when*: two models are compared on the same set and the choice is
      justified by the numbers, not by a leaderboard.

---

## Phase 4: collaboration depth (S20 - S23)

- [ ] **S20. Impact check on move.**
      Moving a shared event shows the impact on every participant.
- [ ] **S21. Alternative slot proposal.**
      Suggest a slot that keeps each participant's focus blocks intact.
- [ ] **S22. Concurrent note editing.**
      Optimistic version check first (S4), CRDT only if measurements show it
      is needed.
- [ ] **S23. Shared availability and workload.**
      Team view of real availability and load, without exposing event details.

---

## Phase 5: integrations (S24 - S27)

- [ ] **S24. Universal inbox** (email, Slack, Teams, Notion capture).
- [ ] **S25. Google Calendar**, two-way sync (OAuth).
- [ ] **S26. Microsoft Outlook**, two-way sync (Graph API).
- [ ] **S27. Apple Calendar** (CalDAV).

Sync must be idempotent and duplicate-free before it is announced.

---

## Phase 6: team orchestrator (S28 - S30)

- [ ] **S28. Multi-member availability analysis**, server-side.
- [ ] **S29. Meeting grouping** to free half-days.
- [ ] **S30. Workload balancing suggestions.**

---

## Not in scope for now

- Self-hosting model weights.
- Mobile native apps.
- SSO / SCIM, organisation-level admin.
- Analytics dashboards beyond usage counters.

## Standing rules

- A feature is only sold once it is shipped and tested.
- RLS is the only authority; the client never decides permissions.
- Any limit is enforced server-side and stated on the pricing page.
- Every schema change ships as a numbered migration in `supabase/`.
