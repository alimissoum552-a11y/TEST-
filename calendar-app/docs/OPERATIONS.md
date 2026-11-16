# Operations: deploy, database, functions, scheduled jobs

Who this is for: the person who ships the app. Product rules are in `docs/PRODUCT.md`, AI rules in `docs/AI.md`,
the plan in `docs/ROADMAP.md`.

Production: https://collyo.app · Supabase project ref `oybvllumenwbzekgxjtz` (eu-west-1, Ireland) · Vercel project
`calendar-app` (team scope, see below) · Git remote `origin` = GitHub repository `TEST-`, branch `main`.

---

## 1. Database

Migrations are numbered files in `calendar-app/supabase/`. Apply them **in order**, once each, on the production
project. Each file is written to be safe to re-run (`if not exists`, `drop policy if exists`).

| File | What it adds |
|---|---|
| `schema.sql` | Base: profiles, calendars, events, RLS, triggers |
| `migrations_001_sharing.sql` | Members, roles, history, Realtime |
| `migrations_002_share_api.sql` | Share lookup, restore function |
| `migrations_003_team_profiles.sql` | Co-members can read profiles |
| `migrations_004_avatars.sql` | Avatar bucket and storage policies |
| `migrations_005_invites.sql` | Invitations, accept, decline |
| `migrations_006_fix_auth_email.sql` | Reads the caller's e-mail without touching `auth.users` |
| `migrations_007_calendar_member_read.sql` | Members can read the calendar row |
| `migrations_008_reminders.sql` | `events.reminder_sent_at`, reset trigger, pending index |
| `migrations_009_assistant.sql` | `profiles.ai_accepted_at`, `calendar_busy()` RPC, `ai_usage` |
| `migrations_010_team_chat.sql` | `messages` table, RLS, Realtime |
| `migrations_011_chat_ai.sql` | `calendars.chat_ai_enabled`, `messages.is_ai`, `chat_ai_notes`, Realtime for both |

Apply one migration (example with the Supabase Management API or the SQL editor). Then check the objects it creates.
Do not edit an applied migration: add a new numbered file.

Realtime publication `supabase_realtime` must contain: `events`, `messages`, `calendars`, `chat_ai_notes`.
Check with:

```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
```

A table missing from this list makes a Realtime subscription on it fail silently for the whole channel. This
happened once with `chat_ai_notes` (fixed in migration 011).

---

## 2. Edge Functions

| Function | Trigger | Auth | Purpose |
|---|---|---|---|
| `send-invite` | App, after an invitation | User JWT | Invitation e-mail through Resend |
| `send-reminders` | pg_cron, every minute | `x-cron-secret` header | Reminder e-mails for due events |
| `assistant` | App, assistant panel | User JWT | Personal read-only assistant |
| `chat-ai` | App, when a member mentions the AI | User JWT | AI reply and notes in the team chat |

Deploy one function (the CLI asks for confirmation in agent mode; `--yes` confirms that one deploy):

```bash
cd calendar-app
SUPABASE_ACCESS_TOKEN=<token> npx -y supabase@latest functions deploy <name> \
  --remote=oybvllumenwbzekgxjtz --yes
rm -rf supabase/.temp          # the CLI leaves a temp folder behind
```

Check the function without a user token (must return 401), then with a test account. Expected statuses:
`assistant`: 403 without consent; `chat-ai`: 409 when the owner's switch is off, 400 without a mention, 403 for a
calendar the caller cannot see; both: 503 when `ANTHROPIC_API_KEY` is missing.

Secrets are set on the project, not on GitHub, and their values are never printed or committed:

| Secret | Required by | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `assistant`, `chat-ai` | Without it both return 503 `assistant_not_configured`. |
| `RESEND_API_KEY` | `send-invite`, `send-reminders` | |
| `INVITE_FROM` | `send-invite` | `Calendar <invites@collyo.app>` |
| `INVITE_REPLY_TO` | `send-invite` | `support@collyo.app` |
| `APP_URL` | `send-invite` | `https://collyo.app` |
| `REMINDER_FROM` | `send-reminders` | Optional, default `Calendar <noreply@collyo.app>` |
| `CRON_SECRET` | `send-reminders` | Same value as the Vault secret `cron_secret`. |

List secret names (never values):

```bash
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/projects/oybvllumenwbzekgxjtz/secrets | jq -r '.[].name'
```

---

## 3. Scheduled job: reminders

Created by `supabase/reminders_cron.sql`, active since 16 November 2026, runs `* * * * *`.

- Calls `send-reminders` with the secret read from Vault (`vault.decrypted_secrets`, name `cron_secret`).
- Sends one e-mail per due event, to the event's creator, then sets `reminder_sent_at`.
- Moving the event or changing the reminder clears `reminder_sent_at` (trigger in migration 008).

Check it:

```sql
select jobname, schedule, active from cron.job where jobname = 'send-reminders';
select status_code, left(content::text, 120) from net._http_response order by id desc limit 3;
```

Expected: a `403` only for calls without the secret; `200` with `{"sent": n}` for the cron calls.

To rotate `CRON_SECRET`: set the new value on the function and update the Vault secret with the same value, in one
change. Otherwise the job gets 403 until both match.

---

## 4. Front-end deploy (Vercel)

### Why the CLI

Vercel does **not** deploy on each push. The GitHub connection is in place, but the GitHub account that authored the
last commit (a GitHub account that is not a member of the team) has no access to the Vercel team, so automatic deployments are blocked
(`TEAM_ACCESS_REQUIRED`). Until this team setting is fixed, deploy with the CLI.

### Commit author rule

Vercel checks the **author of the last commit** of the local repository. It must be an account linked to the team.
Commit with the Vercel account's e-mail, without changing the global Git configuration:

```bash
read -r VN VE <<EOF
$(curl -s -H "Authorization: Bearer $VERCEL_ACCESS_TOKEN" https://api.vercel.com/v2/user \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const u=JSON.parse(s).user;process.stdout.write(u.username.replace(/ /g,'_')+' '+u.email)})")
EOF
git -c user.name="${VN//_/ }" -c user.email="$VE" commit -m "<message>"
```

Do not rewrite history to change an author.

### Deploy command

```bash
cd calendar-app
npx -y vercel@latest deploy --prod --yes --token "$VERCEL_ACCESS_TOKEN" --scope team_p1LFz3tqncsv4Z8uFhwc99Ob
```

Expected output: `status: ok`, `readyState: READY`, production URL `https://collyo.app`. Then check that production
serves the new bundle (the hash in `index-*.js` changes with each build):

```bash
for i in 1 2 3 4; do curl -s "https://collyo.app/?v=$RANDOM$i" | grep -o 'assets/index-[^"]*\.js' | head -1; done | sort | uniq -c
```

The CDN can serve the old bundle for a short time after a deploy. Repeat the check before concluding.

### Build variables

The build reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Vercel project. They are public values,
but they must match the Supabase project above.

---

## 5. Local checks before a deploy

```bash
cd calendar-app
npm test                 # unit tests (date helpers, scheduling)
npx vite build           # production build in dist/ (gitignored)
```

For browser checks, build with the production variables into a temporary folder, serve it, and run the test scripts
against it. Do not leave test data behind: remove test messages, reset `chat_ai_enabled` and
`profiles.ai_accepted_at` for the test account, and check that no reminder mail is pending for it.

---

## 6. Accounts and access

| Account | Purpose | Notes |
|---|---|---|
| Owner of the Vercel team | Deploys, team settings | Enable two-factor authentication. |
| Test account | Browser and API tests | Owns one calendar. Reset its switches after each test. Change its password if it was shared outside the team. |
| Supabase project owner | Migrations, secrets, functions | Access token used by the CLI and the Management API. |

Credentials are not stored in the repository. Tokens come from the environment (`SUPABASE_ACCESS_TOKEN`,
`VERCEL_ACCESS_TOKEN`, `RESEND_API_KEY`, `CLOUDFLARE_API_KEY`). The Cloudflare global key should be replaced by a
token limited to `Zone → DNS → Edit`, then revoked.

---

## 7. Known operational risks

| Risk | Action |
|---|---|
| Automatic Vercel deploys blocked by team settings | Fix the GitHub account / team access in Vercel, or keep deploying by CLI. |
| Cloudflare global key still in use | Replace with a limited token, revoke the global key. |
| Vercel two-factor authentication not confirmed | Enable it on the owner account. |
| Cron secret mismatch after rotation | Change the function secret and the Vault secret together. |
| AI key missing after a project change | Re-add `ANTHROPIC_API_KEY` in Supabase secrets; the functions return 503 until then. |
| `ai_usage` grows without retention | Add a retention job (see `docs/AI.md`, G6). |
| Invitation accepted without a membership row (seen once in production) | Investigate the acceptance path before inviting new people. |
