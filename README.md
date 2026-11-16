# Calendar App

A collaborative web calendar: personal and shared calendars, roles, invitations,
real-time updates, change history with restore, and a monochrome responsive UI in
six languages.

**Live:** https://collyo.app (`www` redirects to the apex)
**Domain:** `collyo.app` — Vercel hosting, Resend e-mail, Cloudflare DNS
**Operator:** AI Solution Hub — Rua Oscar da Silva 83, 2L, 4200-399 Porto, Portugal
**Documentation updated:** 16 November 2026

## Stack

- **Front end:** React 18, Vite 5, Tailwind CSS 3 — no UI library, inline SVG icons
- **Back end:** Supabase (Postgres 17, Auth, Storage, Realtime) in `eu-west-1`
- **E-mail:** Resend, sent from a Supabase Edge Function so the key stays server-side
- **Hosting:** Vercel (project `calendar-app`)
- **i18n:** custom dictionaries — EN (default), FR, ES, DE, AR (RTL), PT

## Repository layout

```
calendar-app/
  src/                 React app
    App.jsx            Calendar shell: views, menu, event panels
    SharePanel.jsx     Members, roles, invites, cancel
    TeamPanel.jsx      Read-only team list with roles
    InvitesPanel.jsx   Accept / decline pending invitations
    JoinPage.jsx       #/join?invite=<id> — joins the team on the invitee's account
    ProfilePanel.jsx   Avatar upload
    LegalPage.jsx      Terms / Privacy / Cookies
    legal.js           Legal content, six languages
    router.js          Hash router (legal pages, join link, sign-in / sign-up)
    i18n/index.jsx     Dictionaries, language picker, RTL handling
    lib/supabase.js    Client (reads VITE_SUPABASE_*)
    lib/api.js         All data access
  supabase/
    schema.sql              Base schema: profiles, calendars, events, RLS, triggers
    migrations_001_*.sql    Sharing roles, history, realtime
    migrations_002_*.sql    Share lookup, restore function
    migrations_003_*.sql    Profiles readable by co-members
    migrations_004_*.sql    Avatars bucket and storage policies
    migrations_005_*.sql    Invitations, accept / decline
    migrations_006_*.sql    Fix: read caller e-mail without touching auth.users
    functions/send-invite/  Edge Function: invitation e-mail via Resend
  docs/
    PRODUCT.md         Product description and positioning
    ROADMAP.md         Ordered development steps S1-S30
```

## Local development

```bash
cd calendar-app
npm install
```

Create `calendar-app/.env.local`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
```

```bash
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the build
```

Without the two variables the app runs in a local, unauthenticated mode: this is
intentional so the UI can be developed offline.

## Database

Apply the SQL files **in order** on a fresh project:

1. `supabase/schema.sql`
2. `supabase/migrations_001_sharing.sql`
3. `supabase/migrations_002_share_api.sql`
4. `supabase/migrations_003_team_profiles.sql`
5. `supabase/migrations_004_avatars.sql`
6. `supabase/migrations_005_invites.sql`
7. `supabase/migrations_006_fix_auth_email.sql`

Tables: `profiles`, `calendars`, `events`, `calendar_members`,
`calendar_invites`, `event_history`. Storage bucket: `avatars` (public read,
per-user write).

Every table has row-level security enabled. Roles on a calendar:
`owner`, `administrator`, `contributor`, `reader`.

## Edge Function

`send-invite` sends the invitation e-mail and must have these secrets:

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | Resend API key |
| `INVITE_FROM` | `Calendar <invites@collyo.app>` |
| `INVITE_REPLY_TO` | `support@collyo.app` |
| `APP_URL` | Public app URL, used to build the join link |

The function requires a signed-in user and only sends for calendars the caller
can manage; RLS decides that, not the function.

### E-mail addresses on collyo.app

Active as of 16 November 2026. All addresses live in Cloudflare Email Routing
and Resend; none of them uses a forwarding destination documented here.

| Address | Purpose |
|---|---|
| `invites@collyo.app` | Sender of invitation e-mails (`INVITE_FROM`) |
| `support@collyo.app` | Reply-to of invitations (`INVITE_REPLY_TO`), general contact in the legal pages |
| `team@collyo.app` | Team contact |
| `noreply@collyo.app` | Outgoing notifications that should not receive replies |

Domain status: verified in Resend (DKIM, SPF, MX, CNAME all verified), with a
DMARC record `v=DMARC1; p=none;`.

## Deployment

Vercel project `calendar-app`, root directory `calendar-app`, framework Vite.
Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Deployments are currently pushed with the Vercel API. Connecting the project to
GitHub would make every push deploy automatically.

## Status

Delivered: events CRUD, realtime, sharing with roles, invitations with
accept/decline/cancel, team panel, change history and restore, avatars, six
languages, legal pages, custom sending domain, custom app domain `collyo.app`.

Not delivered: AI assistant, tasks, focus blocks, scheduling engine, external
calendar sync, billing and plan enforcement, analytics, notifications.

See [docs/ROADMAP.md](calendar-app/docs/ROADMAP.md) for the ordered steps and
[docs/PRODUCT.md](calendar-app/docs/PRODUCT.md) for the product description.

## Legal notice

The legal pages were completed on 16 November 2026: data controller
`AI Solution Hub`, Rua Oscar da Silva 83, 2L, 4200-399 Porto, Portugal,
contact `support@collyo.app`, Portuguese law and the courts of Porto,
processor locations and retention wording are filled in, and no placeholder
remains. Each page shows the company name in the footer.

`calendar-app/Calendar App.fig` is a licensed design file owned by the project
owner. Do not publish or redistribute it as a standalone file.
