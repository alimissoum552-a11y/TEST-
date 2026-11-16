# Calendar App

A collaborative web calendar: personal and shared calendars, roles, invitations,
real-time updates, change history with restore, reminder e-mails, a team chat per
calendar with an optional AI, an AI assistant for planning, and a monochrome
responsive UI in six languages.

**Live:** https://collyo.app (`www` redirects to the apex)
**Domain:** `collyo.app`: Vercel hosting, Resend e-mail, Cloudflare DNS
**Operator:** AI Solution Hub, Rua Oscar da Silva 83, 2L, 4200-399 Porto, Portugal
**Documentation updated:** 16 November 2026

## Documentation

| Document | For | Content |
|---|---|---|
| [README.md](README.md) | Everyone | This page: overview, layout, status |
| [calendar-app/docs/PRODUCT.md](calendar-app/docs/PRODUCT.md) | Product | What the app is for, what is delivered, what is not |
| [calendar-app/docs/AI.md](calendar-app/docs/AI.md) | Product, legal, engineering | AI features, who can do what, data flows, limits, open gaps |
| [calendar-app/docs/OPERATIONS.md](calendar-app/docs/OPERATIONS.md) | Engineering | Migrations, functions, secrets, cron job, deploys |
| [calendar-app/docs/CONNECTOR.md](calendar-app/docs/CONNECTOR.md) | Users | How to add Collyo to Claude as a custom connector, approve it, revoke it |
| [calendar-app/docs/ROADMAP.md](calendar-app/docs/ROADMAP.md) | Everyone | Ordered steps S1 to S30 with their status |
| [calendar-app/AGENTS.md](calendar-app/AGENTS.md), [CLAUDE.md](calendar-app/CLAUDE.md) | AI coding agents | Notes for the design file (Figma) |

`calendar-app/README.md` is the buyer guide of the Figma design package. It is not
a project document.

## Features

- **Calendars**: your own calendar and the calendars shared with you, in a selector that
  shows the owner and your role. Creating or renaming calendars in the interface is not
  available yet.
- **Events**: create, edit, delete; title, location, description, start and end,
  reminder (0 to 60 minutes, chosen when creating or editing). History of every
  change, with restore.
- **Views**: month (navigable, six weeks always shown), week (seven days, Monday first),
  day (24 hours).
- **Sharing**: roles owner, administrator, contributor, reader. Invitations by
  e-mail, with a join link, accept, decline and cancel. The invitee's account must
  match the invited address. A pending invitation survives sign-out and sign-in.
- **Reminders**: an e-mail to the event's creator, sent once when the reminder time is reached
  (checked every minute).
- **Team chat**: one chat per calendar, with history, live messages, online members,
  "is typing", @mentions. Readers read; writers write.
- **AI assistant** (menu **AI**): answers questions about your calendars and suggests
  free times. Read-only. Requires accepting the AI policy first.
- **Claude connector**: connect Collyo to Claude with your own account. You approve it on a consent screen, and you
  can revoke it in your profile. Read-only: calendars, own events with titles, busy times of shared calendars.
- **AI in the team chat**: switched on only by the calendar owner. Replies when a
  member mentions @AI (or @IA, @KI). Keeps shared notes of decisions and tasks.
- **Languages**: English, French, Spanish, German, Arabic (right to left), Portuguese.
- **Legal**: Terms, Privacy Policy and Cookie Policy in six languages, with the AI and chat clauses.

## Stack

- **Front end**: React 18, Vite 5, Tailwind CSS 3. No UI library; inline SVG icons.
- **Back end**: Supabase (Postgres, Auth, Storage, Realtime, Edge Functions, pg_cron) in `eu-west-1`.
- **AI**: Anthropic API (model `claude-sonnet-5-5`), called only from Edge Functions.
- **E-mail**: Resend, sent from Edge Functions so the key stays on the server.
- **Hosting**: Vercel, project `calendar-app`, deployed with the CLI (see OPERATIONS).

## Repository layout

```
README.md                      This file
calendar-app/
  src/                         React app
    App.jsx                    Shell: views, menu, event panels, selector
    ChatPanel.jsx              Team chat, owner's AI switch, AI notes
    AssistantPanel.jsx         AI assistant (personal, read-only)
    SharePanel.jsx             Members, roles, invitations
    TeamPanel.jsx              Team list with roles and the AI notice
    InvitesPanel.jsx           Pending invitations shown to the user
    JoinPage.jsx               #/join?invite=<id>: joins on the matching account
    Root.jsx                   Session, pending invitation, routing
    ProfilePanel.jsx, Avatar.jsx
    LegalPage.jsx, legal.js    Legal content, six languages
    router.js                  Hash routes
    i18n/index.jsx             Dictionaries (six languages), RTL
    lib/api.js                 All data access (database, functions)
    lib/calendar.js            Date helpers (month grid, weeks, labels)
    lib/calendar.test.js       Unit tests for the date helpers
  supabase/
    schema.sql                 Base schema
    migrations_001 ... 011     Numbered migrations, applied in order
    reminders_cron.sql         Scheduled job for reminder e-mails (run once)
    functions/
      send-invite/             Invitation e-mail (Resend)
      send-reminders/          Reminder e-mails, called every minute
      assistant/               AI assistant; scheduling helpers and their tests
      chat-ai/                 AI replies and notes in the team chat
  docs/                        Product, AI, operations, roadmap
```

## Local development

```bash
cd calendar-app
npm install
```

Create `calendar-app/.env.local` with the public values of the Supabase project:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
```

```bash
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # production build in dist/
```

Without the two variables the app runs in a local, unauthenticated mode, so the UI
can be developed offline.

## Database and functions

Apply the migrations in order (`calendar-app/supabase/`), and the scheduled job once.
Full list, secrets and checks: [calendar-app/docs/OPERATIONS.md](calendar-app/docs/OPERATIONS.md).

Every table has row-level security enabled. Roles on a calendar: `owner`,
`administrator`, `contributor`, `reader`. The permission table, checked against the
policies, is in [calendar-app/docs/AI.md](calendar-app/docs/AI.md), section 2.

Edge Functions: `send-invite`, `send-reminders`, `assistant`, `chat-ai`, `mcp` (Claude connector). The OAuth server
settings and the connector are described in [calendar-app/docs/OPERATIONS.md](calendar-app/docs/OPERATIONS.md).

## Deployment

Vercel project `calendar-app`, root directory `calendar-app`, framework Vite.
Automatic deployments on push are blocked by a team setting, so production is
deployed with the CLI, from a commit authored by an account of the team. The steps
are in [calendar-app/docs/OPERATIONS.md](calendar-app/docs/OPERATIONS.md), section 4.

## Status

Delivered: everything in the Features section, plus the realtime updates, the
invitation flow, the history and restore, avatars, the six languages, the legal
pages, the sending domain, and the custom domain `collyo.app`.

Not delivered yet: all-day events and recurring events in the interface, optimistic
concurrency, automated permission tests in the repository, tasks and focus blocks,
the scheduling engine, plans and billing, external calendar sync, the Claude
subscription connector. The ordered plan is in
[calendar-app/docs/ROADMAP.md](calendar-app/docs/ROADMAP.md).

Known gaps and open decisions (for example readers triggering the chat AI, and the
retention of usage records) are listed in [calendar-app/docs/AI.md](calendar-app/docs/AI.md), section 8.

## E-mail addresses on collyo.app

Active as of 16 November 2026. All addresses are handled by Cloudflare Email Routing
and Resend.

| Address | Purpose |
|---|---|
| `invites@collyo.app` | Sender of invitation e-mails (`INVITE_FROM`) |
| `support@collyo.app` | Reply-to of invitations (`INVITE_REPLY_TO`), general contact in the legal pages |
| `team@collyo.app` | Team contact |
| `noreply@collyo.app` | Outgoing notifications that should not receive replies (reminders) |

Domain status: verified in Resend (DKIM, SPF, MX, CNAME all verified), with a
DMARC record `v=DMARC1; p=none;`.

## Legal notice

The legal pages were completed on 16 November 2026: data controller
`AI Solution Hub`, Rua Oscar da Silva 83, 2L, 4200-399 Porto, Portugal, contact
`support@collyo.app`, Portuguese law and the courts of Porto. They are drafts and
must be reviewed by a qualified lawyer before the paid launch.

`calendar-app/Calendar App.fig` is a licensed design file owned by the project
owner. Do not publish or redistribute it as a standalone file.
