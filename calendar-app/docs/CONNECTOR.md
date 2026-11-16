# Connect Collyo to Claude (custom connector)

Audience: a Collyo user who wants to use Claude with their calendar.
Read-only. Claude can read your calendars and free times; it cannot create, move or delete events.

Server address (production):

```
https://oybvllumenwbzekgxjtz.supabase.co/functions/v1/mcp
```

---

The same steps, with the address and a copy button, are in the app: menu → **Claude**.

## 1. Before you start

- **Collyo account**: sign in to https://collyo.app first, so you can approve the connection.
- **Claude plan**: custom connectors using remote MCP are available on Pro, Max, Team and Enterprise. The Free plan
  allows one custom connector. Check the current limits in the Claude help centre:
  https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp
- **Browser**: Claude opens a window to Collyo for the approval step. Allow pop-ups for claude.ai.

## 2. Add Collyo in Claude

1. In Claude, open **Settings → Connectors**. Some layouts show it under **Customize → Connectors**.
2. Choose **Add custom connector** (or the **+** button).
3. If asked for the type, choose **Web** (remote server).
4. Paste the server address from the top of this page.
5. Leave the OAuth fields in **Advanced settings** empty. Collyo registers itself with Claude automatically.
6. Click **Add**, then **Connect**.

Claude opens the Collyo approval page.

## 3. Approve on Collyo

The page is titled **Allow access to your calendar?** and shows:

- the name of the application asking (Claude);
- what it can read: your events and calendars, and the busy times of shared calendars;
- the Collyo account it will use.

Choose **Allow** to connect, or **Deny** to stop. You are then sent back to Claude, and the connector shows as connected.

If the page shows **An application** instead of the name, or you are sent to the sign-in screen, sign in with the
Collyo account first, then start again from step 6 of section 2.

## 4. Use it

In a Claude conversation, ask in plain language. Examples:

- "What is on my calendar tomorrow?"
- "Find a free hour on Thursday between 9 and 18 in Lisbon time."
- "When is my team free next week?" (busy times only, no titles of other people's events)

Claude uses four tools: `list_calendars`, `list_my_events` (your own calendars only), `get_busy_times`
(any calendar you can see, without titles) and `find_free_slots` (free windows during working hours).

## 5. Manage or revoke access

- **In Collyo**: open your profile (avatar, top right) → **Connected apps**. Click **Revoke access** to remove Claude.
  Revocation applies to new requests. Claude then stops working with Collyo until you connect it again.
- **In Claude**: open Settings → Connectors and disconnect Collyo.

## 6. What the connector can and cannot see

| Data | Visible to Claude through Collyo |
|---|---|
| Your own calendars and events, with titles | Yes |
| Calendars shared with you | Busy times only, no titles or descriptions |
| Team chat messages | No |
| Other members' personal settings and profile details | No |
| Ability to change anything | No (read-only tools) |

Your data reaches Claude only when you use the connector in your own Claude account, under Anthropic's terms for
your plan. Collyo does not push data to Claude. See the Privacy Policy, section 12, "Connected apps".

## 7. Troubleshooting

| What you see | Cause | What to do |
|---|---|---|
| "Could not connect" right after **Add** | The address was not copied exactly, or Claude cannot reach it | Copy the address again from this page. The server must be reachable from Anthropic's cloud (it is, over HTTPS). |
| The Collyo approval page does not open | Pop-ups blocked | Allow pop-ups for claude.ai and try again. |
| Approval page asks you to sign in, then nothing happens | The sign-in did not return to the approval page | Start again from Claude (Connect). |
| Claude says it cannot access the calendar | The connection was revoked, or the token expired | Disconnect and connect again. |
| "Titles are only available for your own calendars" | A question asked for titles of a shared calendar | Ask for busy times instead, or ask the calendar owner. |
| Free slots look wrong | The time zone was not given | Say the time zone in the request, for example Europe/Lisbon. |

Still stuck: write to support@collyo.app with the time of the attempt and a screenshot of the error. Do not send a
password or a token.

## 8. For the team

- Each person connects their own Claude account to Collyo. A connection never gives access to someone else's
  calendar beyond what Collyo already allows that person.
- An organisation owner in Claude can add the connector for the whole organisation (Organization settings →
  Connectors). Members still approve it with their own Collyo account.

## 9. For the operator

Technical details, the OAuth server settings and the checks to run after a change are in
[docs/OPERATIONS.md](OPERATIONS.md) (sections on the OAuth server and the `mcp` function) and
[docs/AI.md](AI.md) (section 1.3, and the open gaps G8 to G10).
