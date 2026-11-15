# Development roadmap

Status legend: `[x]` done, `[~]` in progress, `[ ]` planned.

## Phase 0: foundations (done)

- [x] React + Vite + Tailwind front end, responsive mobile / tablet / desktop
- [x] Monochrome design, icon-only mobile nav, icon + label tablet/desktop
- [x] Supabase project, schema `profiles`, `calendars`, `events` with RLS
- [x] Email / password auth, profile and default calendar created by trigger
- [x] i18n: English default, FR / ES / DE / AR (RTL)
- [x] Deployment on Vercel

## Phase 1: MVP (in progress)

Goal: a personal calendar that is editable and shareable in real time.

- [x] Create events
- [x] Delete events
- [~] Edit events (UI and `updateEvent` wiring)
- [ ] Event fields: description, reminder, all-day
- [ ] Real-time updates of the event list (Supabase Realtime)
- [ ] Calendar sharing: `calendar_members` table with roles
      Reader / Contributor / Administrator
- [ ] Shared calendar view for members, with RLS policies by role
- [ ] Activity log: `event_history` table written by trigger
- [ ] Restore a previous version of an event

## Phase 2: collaboration

- [ ] Concurrent edit of event notes (optimistic version check, then CRDT if needed)
- [ ] Avatar of the author on each live change
- [ ] Impact check on participants when an event is moved
- [ ] Proposal of an alternative slot that keeps focus blocks

## Phase 3: planning and focus

- [ ] Focus blocks (deep work, lunch, sport), soft while the calendar is empty
      and locked when it fills
- [ ] Tasks with duration, deadline and priority
- [ ] Automatic placement of tasks into free slots
- [ ] Recalculation of the plan when an event is moved

## Phase 4: integrations

- [ ] Universal inbox (email, Slack, Teams, Notion capture)
- [ ] Two-way sync with Google Calendar (OAuth)
- [ ] Two-way sync with Microsoft Outlook (Graph API)
- [ ] Apple Calendar (CalDAV)

## Phase 5: team orchestrator

- [ ] Analysis of several members' calendars
- [ ] Grouping of meetings to free half-days
- [ ] Shared availability and workload view
