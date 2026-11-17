# AI features and responsibilities

Status: shipped on production in November 2026. Read this with `docs/OPERATIONS.md` (secrets, deploys) and
`supabase/` (the rules themselves). The database policies are the source of truth for every permission below.

---

## 1. What the AI does today

There are two AI features. They share the same model provider, but they have different scopes.

### 1.1 Assistant panel (personal)

Menu entry **AI**. Each signed-in user talks to the assistant about their own calendars.

- Reads: the user's own events, with titles; for calendars shared with the user, **busy times only** (no titles,
  no descriptions); the list of calendars the user can access.
- Computes: free slots inside working hours, with a deterministic function (`supabase/functions/assistant/slots.ts`),
  not by the model.
- Writes: only what the user allowed in the AI settings (create, move, delete: each off by default). Without a permission it
  suggests a time and the user creates the event. It tells the user what it changed. Calendars with minors are hidden from it
  unless the rules of section 1.5 are met.
- Requires: acceptance of the AI policy before the first message (`profiles.ai_accepted_at`).

Edge Function: `assistant` (model `claude-sonnet-5-5`, up to 6 tool rounds, 2000 characters per message, 20 messages
per conversation).

### 1.2 Team chat AI (shared, switched on by the owner)

Chat panel of a calendar. The owner switches the AI on with the sparkle button; it is off by default.

- Trigger: a member writes a message containing `@AI`, `@IA` or `@KI`. Nothing else triggers a call, so there is no
  background processing of the chat.
- Reads: the last 40 messages of the chat and the shared notes.
- Writes: one reply, stored as a chat message flagged `is_ai`; and, when the discussion contains a decision, task or
  plan, an update of the shared notes (`chat_ai_notes`, max 6000 characters).
- Can create, move or delete events only with the AI permissions of the member who mentioned it, and never changes members or
  the switch. A reader cannot trigger it. Calendars with minors follow section 1.5.

Edge Function: `chat-ai`. Reads run with the caller's token (RLS applies); writes run with the service role.

---

### 1.3 Connector (MCP, read-only, any client)

A user can connect Collyo to any AI client that supports custom remote MCP connectors, with their own account
there. Claude is the worked example; the server is client-agnostic. Check in each client's documentation which
plans allow custom connectors. Collyo is then an OAuth provider for that app:

- The user approves the app on the consent page (`#/oauth/consent`), which shows the app name and its permissions.
- The app receives an OAuth access token issued by Supabase Auth (OAuth 2.1 server, dynamic client registration).
- The MCP endpoint `mcp` accepts only tokens issued through the OAuth server (they carry a `client_id` claim). The
  app's own sign-in tokens are refused.
- Four read-only tools, with the same rules as the assistant panel: `list_calendars`, `list_my_events` (own calendars
  only), `get_busy_times` (no titles), `find_free_slots` (deterministic).
- The user can revoke any app in the profile panel ("Connected apps").

Data flow: data reaches the app only when the user uses the connector in their own account. Collyo does not push data
to any client. The Privacy Policy, section 12, says so. The team chat is not exposed by the connector.

### 1.4 Well-being (personal and team)

Described in `docs/WELLBEING.md`. In short:

- **Personal**: the assistant gets a well-being role only when the user switched the mode on. Check-in tools (`log_checkin`,
  `get_checkins`) exist only if the user allowed check-ins. The assistant does not diagnose. If the user shows serious distress, it
  stops coaching and the app shows emergency resources.
- **Team**: `wellbeing-team` runs every hour for calendars whose owner switched the analysis on. It reads the calendar's meeting
  load and, if the owner chose it, the messages of the last hour (without members who opted out), numbered and without names. A
  distress signal creates a private alert for that person only. The group receives at most one message every 12 hours, naming
  nobody. The journal keeps counts, never message text, for 90 days.

### 1.5 Calendars with minors

For family, sports team and class calendars (`docs/FAMILY_TEAM.md`, `docs/MINOR_APP.md`), AI is allowed only if `minor_ai_allowed(calendar)`
is true: every active minor is covered by a signed declaration that includes AI. The adult owner is responsible for that choice;
no operator approval is needed any more. Otherwise `chat-ai` answers 409, the assistant hides the calendar, and `wellbeing-team`
skips it. A minor can ask the chat AI when it is on and covered by the declaration (limit of 20 requests a day, no tool that changes events, replies framed for children as soon as the team has a minor). A minor account cannot use the assistant, the connector or the well-being mode.

## 2. Who can do what

Permissions come from the database (`calendar_role()` and the row policies). The table below was checked against the
policies in production on 16 November 2026.

| Action | Owner | Administrator | Contributor | Reader | Not a member |
|---|:-:|:-:|:-:|:-:|:-:|
| See the calendar, its events and history | yes | yes | yes | yes | no |
| Create an event | yes | yes | yes (own events, `owner_id` = self) | no | no |
| Edit an event | yes | yes | yes (any event of the calendar) | no | no |
| Delete an event | yes | yes | no | no | no |
| Invite, change roles, remove members | yes | yes | no | no | no |
| Cancel invitations | yes | yes | no | no | no |
| Read team chat and shared notes | yes | yes | yes | yes | no |
| Write a chat message | yes | yes | yes | no | no |
| Delete own chat message | yes | yes | yes | no | no |
| Switch the chat AI on or off | **yes** | no | no | no | no |
| Ask the chat AI (`@AI`) | yes | yes | yes | **yes (see gap G1)** | no |
| Rename, delete the calendar | yes | no | no | no | no |

Other responsibilities:

| Actor | Responsibility |
|---|---|
| The person who created an event | Receives its reminder e-mail (`owner_id` of the event). |
| Each user | Accepts the assistant policy once; manages their own events and messages. |
| Members of a shared calendar | Are informed of the chat AI by the banner, and of the availability sharing by the policy and the team panel. They cannot opt out of availability sharing for a calendar they joined (see G4). |
| Server functions | `send-invite`, `send-reminders`, `assistant`, `chat-ai`. Each checks the caller or the cron secret. |
| Supabase | Enforces RLS, Realtime delivery (only rows the caller may read), auth. |
| Anthropic | Processes the requests sent by `assistant` and `chat-ai`. See section 4. |

---

## 3. Data flows

```
Assistant panel:  user question + own events (titles) + busy times of shared calendars  -> Anthropic -> answer
Team chat AI:     @mention + last 40 messages + shared notes                          -> Anthropic -> reply
                  reply and notes                                                    -> Supabase (messages, chat_ai_notes)
Usage:            one row per request: user, time, model, input/output tokens, tool calls -> ai_usage
                  (no prompt or answer text is stored in ai_usage)
```

Stored by the product:

| Table | Content | Who reads it | Kept until |
|---|---|---|---|
| `messages` | Chat messages and AI replies | Members of the calendar | Deleted by the author, or the calendar is deleted |
| `chat_ai_notes` | Shared notes written by the AI | Members of the calendar | The calendar is deleted |
| `ai_usage` | Counts and token totals per request | The user (own rows) | Not deleted automatically yet (see G6) |
| `profiles.ai_accepted_at` | Date the user accepted the assistant policy | The user | Account deleted |
| `calendars.chat_ai_enabled` | Switch state | Members of the calendar | Calendar deleted |

---

## 4. Consent, transparency, legal text

- **Assistant panel**: the user must accept the policy before the first message. The policy text is in the app and in
  the Terms (section 10, "AI assistant") and the Privacy Policy (section 11, "AI assistant", which also names the
  provider), in the six languages.
- **Team chat**: enabling the AI shows a confirmation that explains what is sent. Every member sees a banner while
  the AI is on. The Terms and Privacy text states that the owner turns it on and that only the owner can do so.
- **Provider**: Anthropic. The Privacy page states that processing may happen outside the EU under Standard Contractual
  Clauses, and that the content of questions is not stored by us. Check the current Anthropic terms before relying
  on those statements, and list Anthropic in the processors section when the pages are reviewed by a lawyer.

---

## 5. Limits and safety

| Limit | Value | Where |
|---|---|---|
| Requests per user per day (both features) | 60 | `assistant`, `chat-ai` (counted in `ai_usage`) |
| Messages sent to the model in the chat | last 40 | `chat-ai` |
| Message length | 2000 characters | database check, client, server |
| Notes length | 6000 characters (stored at most 8000) | `chat-ai`, database check |
| Tool rounds per request | 6 (assistant), 4 (chat) | both functions |
| Time window of a tool call | 62 days | `assistant` |
| Model | `claude-sonnet-5-5` | both functions |

Prompt injection: messages written by people are treated as data. The system prompts say so, and the functions only
call the tools listed in code; the model cannot write events, members or the switch.

---

## 6. Secrets and configuration

Supabase Edge Function secrets (set on the Supabase project, not on GitHub):

| Secret | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | `assistant`, `chat-ai`, `wellbeing-team` |
| `RESEND_API_KEY`, `INVITE_FROM`, `INVITE_REPLY_TO`, `APP_URL`, `REMINDER_FROM` (optional) | `send-invite`, `send-reminders` |
| `CRON_SECRET` | `send-reminders`, `wellbeing-team` (also stored in Vault for the cron jobs) |
| `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` | `identity` (see `docs/OPERATIONS.md`) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase to every function.

A GitHub repository secret is not readable by the functions. Do not store the model key only on GitHub.

---

## 7. Tests

- `npm test` runs the unit tests: date helpers (`src/lib/calendar.test.js`) and the scheduling functions, including
  time zones and daylight saving (`supabase/functions/assistant/slots.test.ts`). 21 tests pass.
- Database rules were checked by hand against production with a test account: write and read in its own calendar,
  refusal and empty results in a calendar it does not belong to, refusal of a switch change by a non-owner.
- Interface checks (Playwright, not in the repository yet): assistant consent and reply; team chat between two
  sessions; owner switch; AI reply in the chat and label after reload.

Automated end-to-end tests are not in the repository yet. They belong to step S6 in `docs/ROADMAP.md`.

---

## 8. Known gaps and decisions still open

| # | Gap | Proposed decision |
|---|---|---|
| G1 | Fixed: `chat-ai` requires owner, administrator or contributor. | Done. |
| G2 | The assistant panel does not list a calendar as "consulted" when it only lists calendars. | Count listed calendars in `consulted`. Small fix. |
| G3 | No plan, quota or price yet. Daily cap only. Billing (S7 to S12) is not built. | Set prices from `ai_usage` after a measured period, as agreed. |
| G4 | A member cannot opt out of availability sharing for a calendar they joined. | Add a per-calendar member setting, or a per-user default, before the paid plans. |
| G5 | No e-mail notification for chat messages or AI replies. | Out of scope for now. |
| G6 | `ai_usage` rows are kept without a retention rule. | Add a retention rule (for example 13 months) and say it in the Privacy page. |
| G7 | The assistant policy is a draft, not reviewed by a lawyer. | Lawyer review before the paid launch (step S12). |
| G8 | Connector (section 1.3) is built and tested with direct OAuth calls. The end-to-end test inside a client is still to do by the owner. | Test the connector in claude.ai, then decide on listing. The subscription cannot power the product; the connector only lets the user use Claude with their own calendar data. |
| G9 | Two test OAuth clients created during the tests remain in the `auth` schema (`oauth_clients`). | Delete them from the Supabase dashboard (OAuth apps), not by SQL. |
| G10 | The MCP endpoint accepts any OAuth client that the user approves, not a fixed list. | Review registered clients, or add an allow-list, before listing the connector publicly. |
| G11 | Well-being check-ins have no automatic retention (the 12 months planned in `docs/WELLBEING.md` is not implemented). | Add a retention job, or keep "until the account is deleted" in the Privacy Policy. |
| G12 | Closed: AI for calendars with minors no longer needs an operator approval (`docs/MINOR_APP.md`, section 7). | Done. |
| G13 | Distress detection relies on a model and has not been validated by a mental-health professional. | Clinical review before a wide release. |

---

## 9. How to change the AI safely

1. Change the behaviour in the Edge Function, not in the client. The client must not hold the model key.
2. Write tools exist only behind the user's AI permissions (`ai_permissions`, off by default) and, for calendars with minors,
   behind `minor_ai_allowed()`. Add no write tool without a permission check in the function.
3. Check the permission table in section 2 after any change to the policies, and update the table.
4. Add the limit, the data flow and the legal text together. A new data flow without a privacy sentence is a bug.
5. Deploy the function with `supabase functions deploy <name> --remote=<project-ref> --yes` and check the response
   with a test account, then remove the test data.
