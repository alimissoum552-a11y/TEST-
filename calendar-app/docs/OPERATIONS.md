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
| `migrations_012_mentions.sql` | Member handles (@pseudo), `notifications`, mention trigger, Realtime |
| `migrations_013_ai_permissions.sql` | `ai_permissions` (create, move, delete: off by default) |
| `migrations_013_wellbeing.sql` | `wellbeing_settings`, `wellbeing_checkins`, `team_wellbeing`, `team_wellbeing_optout` (two files carry the number 013; both are applied, the order does not matter) |
| `migrations_014_webauthn.sql` | `webauthn_credentials` (passkeys) |
| `migrations_015_wellbeing_ai.sql` | `wellbeing_alerts` (private), `wellbeing_analysis_log` (owner read) |
| `migrations_016_family_team.sql` | `calendars.kind`, `identity_verifications`, `managed_profiles`, `profile_guardians`, `declarations`, `sign_managed_profile()`, creator check trigger |
| `migrations_017_family_ai.sql` | `ai_legal_approvals`, `minor_ai_allowed()`, `add_guardian_by_email()` |
| `migrations_018_family_rls_fix.sql` | Fix: infinite recursion between the row policies of `managed_profiles` and `profile_guardians` |
| `migrations_019_name_match.sql` | `name_key()` (names compared in any order, without accents), clearer signing errors |
| `migrations_020_minor_access.sql` | `profiles.account_type`, role `minor`, minor restrictions, `team_member_names()`, access and consent columns, `minor_consents`, `minor_login_attempts`, AI rule without operator approval |
| `migrations_023_guardian_invites.sql` | `find_user_id_by_email()` (service role only), `profile_guardian_invites`, linking of an invited adult when the address is confirmed |
| `migrations_024_security_hardening.sql` | NULL role no longer passes the role checks (invite, restore, accept, decline); anonymous access to the RPC functions closed; trigger functions and the purge not callable through the API. Regression test: `supabase/tests/security_regression.sql` |
| `migrations_025_minor_account_cleanup.sql` | Trigger that deletes a minor's sign-in account when its managed profile is deleted (e.g. when the owner's account is deleted) |
| `migrations_026_plans_entitlements.sql` | `plans`, `subscriptions` (every account on the `launch` plan), `ai_usage.billed_to` and `calendar_id`. Nothing is charged: see `docs/PRICING.md` |
| `migrations_022_sex_two_values.sql` | The sex of a managed profile is female, male or empty |
| `migrations_021_minor_no_calendars.sql` | Fix found by the end-to-end test: a minor could create a calendar. Restrictive policies on `calendars`, invitations, members, usage and AI notes |

Apply one migration (example with the Supabase Management API or the SQL editor). Then check the objects it creates.
Do not edit an applied migration: add a new numbered file.

Realtime publication `supabase_realtime` must contain: `events`, `calendar_members`, `messages`, `calendars`, `chat_ai_notes`, `notifications`.
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
| `assistant` | App, assistant panel | User JWT | Personal assistant. Writes events only with the user's permissions. Well-being mode (check-ins, crisis marker). Hides calendars with minors unless `minor_ai_allowed()` is true. |
| `chat-ai` | App, when a member mentions the AI | User JWT | AI reply and notes in the team chat. Needs owner, administrator or contributor. Refuses calendars with minors unless `minor_ai_allowed()` is true (409 `ai_not_approved_for_minors`). |
| `mcp` | MCP connector (any client, Claude is one example) | OAuth access token, checked by the function | Read-only calendar tools. Deploy with `--no-verify-jwt` so the function returns the OAuth challenge itself. |
| `webauthn` | App, passkey sign-in and management | User JWT or signed challenge | Passkeys (WebAuthn). Deployed with `--no-verify-jwt`. |
| `wellbeing-team` | pg_cron, every hour | `x-cron-secret` header | Team well-being analysis: meeting load per day, message review, private distress alerts, group message at most every 12 hours, analysis journal. Deployed with `--no-verify-jwt`. |
| `identity` | App (start) and Stripe (webhook) | User session for the start; Stripe signature for the webhook | Identity verification of the creators of family, sports team and class calendars. Deployed with `--no-verify-jwt`. |
| `minor-access` | App (adult owner) and the minor login page | User session for create, regenerate, disable; none for login (limited attempts) | Access identifier of a minor and login. Deployed with `--no-verify-jwt`. |
| `minor-consent` | App (adult owner) and the consent page | User session for the request; a one-time token for info and approve | Guardian consent by e-mail for a child who may be under 13, and invitation of an adult responsible by e-mail (with or without an account). Deployed with `--no-verify-jwt`. |
| `team-admin` | App (calendar owner) | User session, owner of the calendar | Removes a minor profile together with the technical account of the minor, and deletes a calendar (minor accounts first, then the event history). The personal calendar cannot be deleted. |
| `delete-account` | App (profile panel, "Delete my account") | User session; the account's own e-mail typed as confirmation; refuses minors | Deletes the caller's calendars (database cascade), the technical accounts of their minors, their avatar files and their sign-in account. |
| `billing` | App (later), Stripe webhook | `checkout` and `portal`: user session; webhook: Stripe signature (`STRIPE_BILLING_WEBHOOK_SECRET`). Deployed with `--no-verify-jwt` | Stripe Billing: Checkout session, customer portal, and the webhook that writes `subscriptions`. Test and live keys side by side (`STRIPE_BILLING_API_KEY`, `STRIPE_BILLING_LIVE_API_KEY`), mode chosen by `BILLING_MODE` (unset = test); see `docs/PRICING.md`. |

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
| `ANTHROPIC_API_KEY` | `assistant`, `chat-ai`, `wellbeing-team` | Without it the first two return 503 `assistant_not_configured`; `wellbeing-team` skips the model calls. |
| `RESEND_API_KEY` | `send-invite`, `send-reminders` | |
| `INVITE_FROM` | `send-invite` | `Calendar <invites@collyo.app>` |
| `INVITE_REPLY_TO` | `send-invite` | `support@collyo.app` |
| `APP_URL` | `send-invite` | `https://collyo.app` |
| `REMINDER_FROM` | `send-reminders` | Optional, default `Calendar <noreply@collyo.app>` |
| `CRON_SECRET` | `send-reminders`, `wellbeing-team` | Same value as the Vault secret `cron_secret`. |
| `WEBAUTHN_SECRET` | `webauthn` | Signs the passkey challenges. |
| `MCP_PUBLIC_URL` | `mcp` | Public base address announced to clients. |
| `STRIPE_API_KEY` | `identity` | Secret key of the **dedicated Collyo Stripe account**. Its mode (test or live) is the mode of the key. |
| `STRIPE_WEBHOOK_SECRET` | `identity` | Signing secret of the Collyo webhook endpoint, same mode as the key. |
| `MINOR_ID_SECRET` | `minor-access` | Key used to hash the access identifiers and the login attempt keys. Long random value (`openssl rand -hex 32`). Changing it invalidates every identifier. |

List secret names (never values):

```bash
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/projects/oybvllumenwbzekgxjtz/secrets | jq -r '.[].name'
```

---

### Stripe Identity (creators of family, sports team and class calendars)

- A **dedicated Stripe account** for Collyo, separate from other products. Only the creator of a family, sports team or
  class calendar is verified. Other members, including minors, are added with a signed declaration
  (`docs/FAMILY_TEAM.md`).
- Function `identity`, deployed with `--no-verify-jwt`. Without the `Stripe-Signature` header it needs a user session and
  starts a verification session (document, matching selfie, live capture, return address `https://collyo.app/`). With the
  header it checks the webhook signature (5 minutes tolerance) and records the result.
- Webhook endpoint, in the Stripe dashboard and **in the same mode as the key**:
  `https://oybvllumenwbzekgxjtz.supabase.co/functions/v1/identity`. Events: `identity.verification_session.verified`,
  `identity.verification_session.requires_input`, `identity.verification_session.canceled`.
- A restricted key needs the permission **Identity Verification Results: write**. The function reads `STRIPE_API_KEY`.
- The session carries `metadata.user_id`. A session created by hand in the Stripe dashboard has none and is ignored.
- Stored in `identity_verifications`: status, verified name, country, session identifier. Never the document or the selfie.
- Checks: without a login the start returns 401; an invalid signature returns 400; when Stripe refuses, the error code and
  message are returned to the calendar owner and shown in brackets in the Team panel.
- Changing mode (test to live): replace both secrets, create the webhook in the matching mode, and keep the old key out of
  the repository and out of GitHub secrets.

### Public address of the connector

`https://collyo.app/mcp` is rewritten to the `mcp` function by `calendar-app/vercel.json`. The function reads its public
address from the secret `MCP_PUBLIC_URL` (`https://collyo.app/mcp`) and announces it in the protected-resource metadata
and in the OAuth challenge. Changing the address needs both: the rewrite and the secret, then a redeploy of the function
and of the front end.

### OAuth server (MCP connector)

Enabled on the project through the Management API (`PATCH /v1/projects/<ref>/config/auth`):
`oauth_server_enabled: true`, `oauth_server_allow_dynamic_registration: true`,
`oauth_server_authorization_path: "/#/oauth/consent"`. Discovery:
`https://<ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`. The MCP protected-resource metadata is at
`https://<ref>.supabase.co/functions/v1/mcp/metadata`. Check both after any auth change.

Test clients created by dynamic registration are removed in the Supabase dashboard. Do not delete rows of the `auth`
schema by SQL.

### An e-mail that did not arrive

Authentication e-mails (confirmation, reset) go through Supabase with Resend as SMTP (`smtp.resend.com`, sender `noreply@collyo.app`);
invitations and consent e-mails are sent by the Edge Functions through the Resend API. To check one:

1. Supabase: `select email_confirmed_at, confirmation_sent_at from auth.users where email = ...` shows whether the server tried to send.
2. Resend: `GET https://api.resend.com/emails?limit=20` (key `RESEND_API_KEY`) lists each message with `last_event` (`delivered`, `bounced`, ...).
   `delivered` means the recipient server accepted it: the message is then in the inbox, the spam or the promotions folder.
3. DNS of `collyo.app` (verified): SPF on `send.collyo.app`, DKIM `resend._domainkey`, DMARC `p=none`.

The sign-up screen shows a spam hint and a button to send the confirmation e-mail again (once a minute). An address that already
has a confirmed account gets no e-mail from Supabase: the screen says so.

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

### Other scheduled jobs

| Job | Schedule | File | What it does |
|---|---|---|---|
| `wellbeing-team` | `17 * * * *` | `supabase/wellbeing_cron.sql` | Calls the `wellbeing-team` function with the Vault secret |
| `wellbeing-log-retention` | `30 3 * * *` | `supabase/wellbeing_cron.sql` | Deletes analysis journal rows older than 90 days |
| `family-purge-pending` | `40 3 * * *` | `supabase/family_cron.sql` | Deletes minor profiles still pending after 30 days |
| `minor-attempts-purge` | `50 3 * * *` | `supabase/family_cron.sql` | Deletes minor login attempts older than one day |
| `guardian-invites-purge` | `55 3 * * *` | `supabase/family_cron.sql` | Deletes invitations of adults responsible unused after 30 days |

Check them: `select jobname, schedule, active from cron.job order by jobname;`

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

Run from the **repository root**, not from `calendar-app/`. The Vercel project has the root directory `calendar-app`;
a CLI deploy started inside that folder fails with "The specified Root Directory \"calendar-app\" does not exist".
Keep the project settings as they are (root directory `calendar-app`, framework Vite, build `npm run build`, output
`dist`, Node 26.x, production domain `collyo.app`, `www` redirects to the apex).

```bash
cd /workspaces/TEST-
npx -y vercel@latest deploy --prod --yes --name calendar-app --token "$VERCEL_ACCESS_TOKEN" --scope team_p1LFz3tqncsv4Z8uFhwc99Ob
```

A failed attempt from `calendar-app/` creates a deployment in state `ERROR`. It does not change `collyo.app`, which
keeps the last `READY` deployment, but check the list of deployments and remove nothing else.

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
| Stripe account (Collyo) | Identity verification of creators | Dedicated account. The key lives only in Supabase secrets, never in the repository or in GitHub secrets. |

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
| Stripe key in live mode before the legal review of `docs/FAMILY_TEAM.md` | Real identity documents are processed. Complete the review, or go back to a test key. |
| Webhook secret and key in different modes | Verification results are rejected (400) and the creator stays pending. Keep both in the same mode. |
| The restricted key of the previous, shared Stripe account is still valid | Revoke it in the Stripe dashboard of that account. Change nothing else on that account. |
| Well-being check-ins are not purged automatically | There is no retention job for `wellbeing_checkins`. Add one, or keep the Privacy Policy wording ("until you delete your account"). |
| `MINOR_ID_SECRET` lost or changed | Every access identifier stops working; the adults must issue new ones. Keep it with the other secrets. |
| A calendar deleted outside the app | Since migration 025 a trigger deletes the minor's technical account when its managed profile row goes, so SQL deletion no longer leaves it behind. The app (`team-admin`) still deletes the accounts first. |

## E-mail branding

Every e-mail starts with the Collyo "C" mark and the name.

- E-mails sent by the Edge functions (send-invite, send-reminders, minor-consent) use `brandHeader()` from `supabase/functions/_shared/brand.ts`. The image is `https://collyo.app/logo-192.png`, served from `public/logo-192.png`: do not rename or remove that file.
- The Supabase Auth e-mails (confirmation, password reset, magic link, invitation, e-mail change) are project settings, not code. They carry the same header, set with the Management API (`PATCH /v1/projects/{ref}/config/auth`, fields `mailer_templates_*_content`). Re-apply the header if the templates are ever reset.
