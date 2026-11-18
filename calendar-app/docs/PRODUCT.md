# Calendar App: product description

## Vision

A single application that orchestrates individual and team time in real time.
It combines three ideas:

- **Automatic planning** (inspired by Motion): tasks are placed in the calendar
  according to deadlines, priorities and energy level.
- **Focus protection** (inspired by Reclaim.ai): deep-work, lunch and routine
  blocks stay flexible while the calendar is empty, then lock when the week fills.
- **Team sync** (inspired by Clockwise): meetings are grouped together, and
  shared availability is visible across members.

## Core pillars

1. **Dynamic planning engine**: splits projects into tasks and schedules them.
   Recalculates when something changes.
2. **Focus and habits shield**: protected blocks for deep work, meals and sport.
3. **Universal inbox**: captures requests from email, Slack, Teams or Notion and
   turns them into scheduled slots.
4. **Team orchestrator**: analyses members' calendars and proposes slots that
   do not break focus blocks.

## Usage profiles

| Dimension | Personal | Professional (freelance / manager) | Team |
|---|---|---|---|
| Main benefit | Work/life balance without mental load | Maximum productivity, no missed deadline | Shared alignment, fewer fragmented meetings |
| AI action | Places errands, sport and leisure around family constraints | Protects deep-work time, manages booking links | Finds a slot for N people by moving flexible tasks |
| Visibility | Private by default, selective sharing | "Busy" status visible without task details | Shared availability and workload view |

## Collaboration

- **Real-time editing**: several members can edit an event's notes and agenda at once.
  Changes appear live with the author's avatar.
- **Granular roles** per calendar or event:
  - *Administrator*: edits schedule and invitees.
  - *Contributor*: adds notes and tasks.
  - *Reader*: sees the time slot only.
- **Schedule negotiation**: moving a shared event checks the impact on every
  participant and proposes a slot that keeps critical focus blocks intact.
- **Version history and activity log**: every change (time, place, description,
  task status) is recorded, and a previous version can be restored.
- **Two-way sync** with Google, Outlook and Apple as a central layer, without duplicates.

## Delivered on top of the calendar

- **Team chat per calendar**, with online members, "is typing" and @mentions.
  Readers can read; writers can write; each author can delete their own messages.
- **AI assistant** (personal): answers questions about the user's calendars and
  suggests free times. It reads titles only for the user's own calendars, and only
  busy times for shared ones. It creates, moves or deletes events only if the user
  allows it in the AI settings.
- **AI in the team chat**, switched on only by the owner. When a member mentions
  the AI, it replies and keeps shared notes of decisions, tasks and plans.
- **Consent and transparency**: the assistant policy is accepted before first use;
  members are told when the chat AI is on and that availability is shared.

- **Mentions and notifications**: each member has a handle (@pseudo); a mention rings the bell.
- **Sign-in**: passkeys (WebAuthn) and password reset by e-mail.
- **Well-being mode** (optional): personal settings and energy check-ins; a team analysis switched on by the owner
  (meeting load, optional message review) with private distress alerts and an owner journal. Not medical advice.
- **Family, sports team and class calendars**: the creator is verified with Stripe Identity; minors are added as managed
  profiles that stay in review until an adult responsible signs a declaration; AI is blocked for calendars with minors until
  a legal approval is recorded. A verified badge appears on the creator's profile.
- **Team calendars and minor access**: a calendar dedicated to a family, sports team or class, visible to its members only. A
  minor gets a limited access (team calendar read-only, team chat) with the e-mail of the team owner and an access ID; under 13, the
  guardian approves by e-mail first.
- **Connector** (MCP, read-only) for any compatible AI client.

How these work, who can do what, and the limits are in `docs/AI.md`, `docs/WELLBEING.md` and `docs/FAMILY_TEAM.md`.

## Plans

Free (no AI), Starter, Pro, Team (groups) and Team (work), on sale through Stripe since 19 November 2026; education at half price. The AI follows the calendar: requests made in a team calendar count on the owner's plan. Details in `docs/PRICING.md`.

## Plans and billing

Free (no AI), Starter, Pro, Team (groups) and Team (work) are sold through Stripe, which acts as reseller (Managed Payments) and handles VAT. The AI quota follows the calendar owner's plan. Accounts created before 19 November 2026 keep the launch plan (unlimited AI). See `docs/PRICING.md`.

## Not yet delivered

Automatic planning (tasks, focus blocks, scheduling engine), project
decomposition, universal inbox, team orchestrator, external calendar sync,
the limits on shared calendars and members per plan, the minor's own account and view, a screen to record the legal approval of AI for calendars with minors,
an automatic purge of well-being check-ins. These are listed in `docs/ROADMAP.md` and in the design documents.
