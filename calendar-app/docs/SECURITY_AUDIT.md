# Security audit, 18 November 2026

Scope: Edge functions, database access rules (RLS and RPC), site headers, dependencies, e-mail DNS.
Method: calls without credentials, with a forged token and with a wrong secret; read-only SQL; rolled-back SQL transactions on production (nothing was kept); Supabase security advisors; `npm audit`.

## Found and fixed by migration 024 (applied to production on 18 November 2026; the regression test then reported every abuse as blocked, and the owner invite, restore and invitee accept flows still worked)

| # | Severity | Finding | Proof (rolled back) |
|---|----------|---------|---------------------|
| 1 | High | `invite_to_calendar` tested `calendar_role(...) not in (...)`. A caller with no role gives NULL, so the error was never raised. Any signed-in user could invite themselves to any calendar as administrator, then accept. Needs the calendar id. | Non-member became administrator. |
| 2 | High | `restore_event_version` had the same defect and is callable by anonymous visitors. History ids are sequential, so an anonymous visitor could read event content and overwrite events with an older version. | Anonymous call returned the event row. |
| 3 | Low | `decline_invite` and `accept_invite`: an anonymous caller has no e-mail (NULL), so the identity check passed. Anonymous could decline someone else's invite (needs the invite id, random). | Invite status became "declined". |
| 4 | Low | 22 `SECURITY DEFINER` functions were callable by anonymous visitors through `/rest/v1/rpc`, among them the scheduled purge and trigger functions. | Supabase advisors, 40 warnings. |

Fix: NULL now counts as "no role" (`coalesce`, `is distinct from`, explicit `auth.uid() is null`); anonymous execution revoked on all of them; trigger functions and the purge are not callable through the API at all. Regression test: `supabase/tests/security_regression.sql` (run it after any change to these functions; every line must say "blocked").

## Checked and correct

- All 25 public tables have RLS on.
- Every Edge function refuses calls without a valid user token, with the anonymous key, and with a forged token (401).
- Cron functions (`send-reminders`, `wellbeing-team`) refuse a wrong or missing `x-cron-secret`.
- The Stripe webhook refuses a bad signature.
- Consent links: bad or malformed tokens give the same `invalid_link`.
- Minor login: locked after 20 failures per address (429); a spoofed `X-Forwarded-For` does not reset it. Access identifiers have 60 bits.
- `npm audit` (production dependencies): 0 vulnerabilities.
- Mail DNS: DKIM present, SPF on the sending subdomain, DMARC present.

## Open (not changed)

- A signed-out visitor who queries a table through the API now gets "permission denied" instead of an empty list. The app never does this signed out.

- Site headers: only HSTS is sent. No Content-Security-Policy, X-Frame-Options (clickjacking), X-Content-Type-Options, Referrer-Policy or Permissions-Policy.
- DMARC is `p=none` (monitoring only). Move to `quarantine` once reports show only Collyo mail.
- Supabase Auth: leaked-password protection (HaveIBeenPwned) is off.
- `calendar_role(cal, uid)`, `is_minor(uid)`, `minor_ai_allowed(cal)` still tell a signed-in user the role, minor status or AI state for ids they already know (needed by the access rules). Ids are random, so low risk.
- `webauthn` `auth-options` uses `ilike` on the e-mail: `%` and `_` act as wildcards, so a signed-out caller can test e-mail prefixes. Replace with an exact lower-case match.
- Four helper functions have no fixed `search_path` (`touch_updated_at`, `reset_reminder_on_change`, `normalize_name`, `name_key`); `pg_net` is in the `public` schema.
- Not yet tested: AI prompt injection, MCP token scope and revocation, deleting an account and a minor's data end to end, backup restore, other browsers, load.
