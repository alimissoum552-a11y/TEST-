# Connect Collyo to an AI client (MCP connector)

Audience: a Collyo user who wants to use their calendar from an AI client.
The connector is a standard remote MCP server, so it works with any client that supports custom MCP connectors.
Read-only. The client can read your calendars and free times; it cannot create, move or delete events.

Claude is used below as the worked example. The same address and the same approval flow apply to other
MCP-capable clients; only the menu names differ.

Server address (production):

```
https://collyo.app/mcp
```

---

The same steps, with the address and a copy button, are in the app: menu → **Connector**.

## 1. Before you start

- **Collyo account**: sign in to https://collyo.app first, so you can approve the connection.
- **AI client**: it must support custom remote MCP connectors. Some clients require a paid plan for that; for Claude,
  see the help centre: https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp
- **Browser**: the client opens a window to Collyo for the approval step. Allow pop-ups for the client's domain.

## 2. Add Collyo in your client (Claude example)

1. Open the connector settings of your client. In Claude: **Settings → Connectors**, sometimes under
   **Customize → Connectors**.
2. Choose **Add custom connector** (or the **+** button).
3. If asked for the type, choose **Web** (remote server).
4. Paste the server address from the top of this page.
5. Leave the OAuth fields in **Advanced settings** empty. Collyo registers itself with the client automatically.
6. Click **Add**, then **Connect**.

The client opens the Collyo approval page.

## 3. Approve on Collyo

The page is titled **Allow access to your calendar?** and shows:

- the name of the application asking (for example Claude);
- what it can read: your events and calendars, and the busy times of shared calendars;
- the Collyo account it will use.

Choose **Allow** to connect, or **Deny** to stop. You are then sent back to the client, and the connector shows as connected.

If the page shows **An application** instead of the name, or you are sent to the sign-in screen, sign in with the
Collyo account first, then start again from step 6 of section 2.

## 4. Use it

In a conversation with your AI client, ask in plain language. Examples:

- "What is on my calendar tomorrow?"
- "Find a free hour on Thursday between 9 and 18 in Lisbon time."
- "When is my team free next week?" (busy times only, no titles of other people's events)

The client uses four tools: `list_calendars`, `list_my_events` (your own calendars only), `get_busy_times`
(any calendar you can see, without titles) and `find_free_slots` (free windows during working hours).

## 5. Manage or revoke access

- **In Collyo**: open your profile (avatar, top right) → **Connected apps**. Click **Revoke access** to remove that app.
  Revocation applies to new requests. The app then stops working with Collyo until you connect it again.
- **In the client**: open its connector settings and disconnect Collyo (in Claude: Settings → Connectors).

## 6. What the connector can and cannot see

| Data | Visible to the client through Collyo |
|---|---|
| Your own calendars and events, with titles | Yes |
| Calendars shared with you | Busy times only, no titles or descriptions |
| Team chat messages | No |
| Other members' personal settings and profile details | No |
| Ability to change anything | No (read-only tools) |

Your data reaches the client only when you use the connector from your own account there, under that provider's
terms. Collyo does not push data to any client. See the Privacy Policy, section 12, "Connected apps".

## 7. Troubleshooting

| What you see | Cause | What to do |
|---|---|---|
| "Could not connect" right after **Add** | The address was not copied exactly, or the client cannot reach it | Copy the address again from this page. The server must be reachable from the provider's cloud (it is, over HTTPS). |
| The Collyo approval page does not open | Pop-ups blocked | Allow pop-ups for the client's domain and try again. |
| Approval page asks you to sign in, then nothing happens | The sign-in did not return to the approval page | Start again from the client (Connect). |
| The client says it cannot access the calendar | The connection was revoked, or the token expired | Disconnect and connect again. |
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
