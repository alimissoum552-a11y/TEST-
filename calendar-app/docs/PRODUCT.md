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
  suggests free times. Read-only; it reads titles only for the user's own
  calendars, and only busy times for shared ones.
- **AI in the team chat**, switched on only by the owner. When a member mentions
  the AI, it replies and keeps shared notes of decisions, tasks and plans.
- **Consent and transparency**: the assistant policy is accepted before first use;
  members are told when the chat AI is on and that availability is shared.

How these work, who can do what, and the limits are in `docs/AI.md`.

## Not yet delivered

Automatic planning (tasks, focus blocks, scheduling engine), project
decomposition, universal inbox, team orchestrator, external calendar sync,
plans and billing, the Claude subscription connector. These are listed in
`docs/ROADMAP.md`.
