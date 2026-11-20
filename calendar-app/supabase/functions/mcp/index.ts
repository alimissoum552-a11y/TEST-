// MCP server (Streamable HTTP, JSON responses) for connectors such as Claude.
// Read-only tools over the calendars the caller can access. Every request must carry an OAuth access token issued by
// Supabase Auth (OAuth 2.1 server, enabled in the project). The token's user is the only identity used; RLS decides
// what is visible. Deploy with --no-verify-jwt: the function answers 401 itself, with the discovery header MCP clients use.
//
// Endpoints:
//   POST /functions/v1/mcp            JSON-RPC 2.0 messages (initialize, tools/list, tools/call, ping)
//   GET  /functions/v1/mcp/metadata   OAuth protected-resource metadata (RFC 9728)
// Secrets: none. Provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { findFreeSlots, type Interval } from './slots.ts'
import { reportError } from '../_shared/ops.ts'
import { ADMIN_TOOLS, isAdmin, runAdminTool } from './admin.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
}

const PROTOCOL_VERSION = '2025-06-18'
const SERVER_INFO = { name: 'collyo-calendar', version: '1.0.0' }
const MAX_WINDOW_DAYS = 62
const MAX_EVENTS = 200

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

const TOOLS = [
  {
    name: 'whoami_collyo',
    description: 'Report the identity and connection state of the current Collyo account. Read-only diagnostic: call it to check the connection before using other tools.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Who am I', ...READ_ONLY },
  },
  {
    name: 'list_calendars',
    description: 'List the calendars the user can access: id, name, role, and whether they are shared.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'List calendars', ...READ_ONLY },
  },
  {
    name: 'list_my_events',
    description: "List events with titles of one of the user's OWN calendars in a time window.",
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'string' },
        from: { type: 'string', description: 'ISO 8601 start, e.g. 2026-11-16T00:00:00Z' },
        to: { type: 'string', description: 'ISO 8601 end, exclusive' },
      },
      required: ['calendar_id', 'from', 'to'],
      additionalProperties: false,
    },
    annotations: { title: 'List my events', ...READ_ONLY },
  },
  {
    name: 'get_busy_times',
    description: 'Busy time ranges of any accessible calendar, shared ones included. Titles are never returned.',
    inputSchema: {
      type: 'object',
      properties: { calendar_id: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } },
      required: ['calendar_id', 'from', 'to'],
      additionalProperties: false,
    },
    annotations: { title: 'Get busy times', ...READ_ONLY },
  },
  {
    name: 'find_free_slots',
    description: 'Free windows of at least the given duration, inside working hours, when all the listed calendars are free.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_ids: { type: 'array', items: { type: 'string' } },
        from: { type: 'string' },
        to: { type: 'string' },
        duration_minutes: { type: 'integer', minimum: 5, maximum: 480 },
        timezone: { type: 'string', description: 'IANA time zone, e.g. Europe/Lisbon. Default UTC.' },
        work_start_hour: { type: 'integer', minimum: 0, maximum: 23 },
        work_end_hour: { type: 'integer', minimum: 1, maximum: 24 },
      },
      required: ['calendar_ids', 'from', 'to', 'duration_minutes'],
      additionalProperties: false,
    },
    annotations: { title: 'Find free slots', ...READ_ONLY },
  },
]

type Cal = { id: string; name: string; role: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  // Public address clients use (collyo.app/mcp, rewritten by Vercel). Falls back to the Supabase function URL.
  const base = Deno.env.get('MCP_PUBLIC_URL') ?? `${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp`

  if (req.method === 'GET' && url.pathname.endsWith('/metadata')) {
    return json({
      resource: base,
      authorization_servers: [`${Deno.env.get('SUPABASE_URL')}/auth/v1`],
      bearer_methods_supported: ['header'],
      resource_name: 'Collyo calendar',
      scopes_supported: ['openid', 'profile', 'email'],
    })
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const challenge = `Bearer resource_metadata="${base}/metadata"`
  if (!token) return json({ error: 'unauthorized' }, 401, { 'WWW-Authenticate': challenge })

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await supa.auth.getUser(token)
  if (!user) return json({ error: 'invalid_token' }, 401, { 'WWW-Authenticate': `${challenge}, error="invalid_token"` })
  // Only tokens issued through the OAuth server (they carry a client_id). The app's own sign-in tokens do not.
  if (!oauthClientId(token)) return json({ error: 'invalid_token' }, 401, { 'WWW-Authenticate': `${challenge}, error="invalid_token"` })

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const msg = await req.json().catch(() => null)
  if (!msg || typeof msg !== 'object') return rpcError(null, -32700, 'Parse error')
  const id = msg.id ?? null
  const isNotification = msg.id === undefined

  try {
    switch (msg.method) {
      case 'initialize':
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: isAdmin(user.id)
            ? 'Read-only access to the user\'s calendars, plus the founder\'s campaign tools (metrics, plans, founding-club codes, education requests). Ask the founder before creating a code or deciding a request.'
            : 'Read-only access to the user\'s calendars. Use find_free_slots for scheduling.',
        })
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return new Response(null, { status: 202, headers: cors })
      case 'ping':
        return rpcResult(id, {})
      case 'tools/list':
        // The founder's account also gets the campaign tools (admin.ts); everyone else, the calendar tools only.
        return rpcResult(id, { tools: isAdmin(user.id) ? [...TOOLS, ...ADMIN_TOOLS] : TOOLS })
      case 'tools/call': {
        const name = msg.params?.name
        const args = msg.params?.arguments ?? {}
        const adminTool = ADMIN_TOOLS.some((t) => t.name === name)
        if (adminTool && !isAdmin(user.id)) return rpcError(id, -32602, `Unknown tool: ${name}`)
        if (!adminTool && !TOOLS.some((t) => t.name === name)) return rpcError(id, -32602, `Unknown tool: ${name}`)
        const out = adminTool
          ? await runAdminTool(name, args, createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)).catch((e) => ({ error: (e as Error).message }))
          : await runTool(name, args, supa)
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(out) }],
          isError: Boolean((out as any)?.error),
        })
      }
      default:
        if (isNotification) return new Response(null, { status: 202, headers: cors })
        return rpcError(id, -32601, `Method not found: ${msg.method}`)
    }
  } catch (e) {
    await reportError('mcp', e)
    return rpcError(id, -32603, 'Internal error')
  }
})

// ---- tools (read-only; same rules as the in-app assistant) ----


async function runTool(name: string, input: any, supa: SupabaseClient): Promise<unknown> {
  try {
    // Diagnostic first: it must answer even when the rest of the account is unavailable.
    if (name === 'whoami_collyo') {
      const { data: { user }, error: authError } = await supa.auth.getUser()
      if (authError) return { authenticated: false, connected: false, error: 'auth_check_failed' }
      if (!user) return { authenticated: false, connected: false, error: 'not_authenticated' }
      const { data: me, error: profileError } = await supa.from('profiles')
        .select('display_name, email').eq('id', user.id).maybeSingle()
      if (profileError) return { authenticated: true, connected: false, error: 'profile_unavailable' }
      return {
        authenticated: true,
        connected: true,
        user_id: user.id,
        email: me?.email ?? null,
        name: me?.display_name ?? null,
        workspace_id: null,
        checked_at: new Date().toISOString(),
      }
    }
    const cals = await accessibleCalendars(supa)
    const byId = new Map(cals.map((c) => [c.id, c]))
    const calendarFor = (id: unknown): Cal => {
      const c = byId.get(String(id))
      if (!c) throw new Error('calendar not accessible')
      return c
    }

    if (name === 'list_calendars') {
      return cals.map((c) => ({ id: c.id, name: c.name, role: c.role, shared: c.role !== 'owner' }))
    }
    if (name === 'list_my_events') {
      const c = calendarFor(input.calendar_id)
      if (c.role !== 'owner') return { error: 'Titles are only available for your own calendars. Use get_busy_times.' }
      const { from, to } = windowOf(input.from, input.to)
      const { data, error } = await supa.from('events')
        .select('title, starts_at, ends_at, location').eq('calendar_id', c.id)
        .gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString())
        .order('starts_at').limit(MAX_EVENTS)
      if (error) throw error
      return data
    }
    if (name === 'get_busy_times') {
      const c = calendarFor(input.calendar_id)
      const { from, to } = windowOf(input.from, input.to)
      return { calendar: c.name, busy: (await busyOf(supa, c.id, from, to)).map(toIso) }
    }
    if (name === 'find_free_slots') {
      const ids: string[] = Array.isArray(input.calendar_ids) ? input.calendar_ids : []
      if (!ids.length) return { error: 'calendar_ids is empty' }
      const { from, to } = windowOf(input.from, input.to)
      const busy: Interval[] = []
      for (const cid of ids) busy.push(...(await busyOf(supa, calendarFor(cid).id, from, to)))
      const slots = findFreeSlots({
        busy, from: from.getTime(), to: to.getTime(), timeZone: validTimeZone(input.timezone),
        durationMs: Number(input.duration_minutes) * 60_000,
        startHour: clampInt(input.work_start_hour, 9, 0, 23),
        endHour: clampInt(input.work_end_hour, 18, 1, 24),
      })
      return { duration_minutes: input.duration_minutes, slots: slots.map(toIso) }
    }
    return { error: `unknown tool ${name}` }
  } catch (e) {
    return { error: (e as Error).message || 'tool_failed' }
  }
}

async function accessibleCalendars(supa: SupabaseClient): Promise<Cal[]> {
  const { data: { user } } = await supa.auth.getUser()
  if (!user) throw new Error('not signed in')
  // A minor account cannot use the connector.
  const { data: me } = await supa.from('profiles').select('account_type').eq('id', user.id).maybeSingle()
  if (me?.account_type === 'minor') throw new Error('not allowed')
  const { data: cals, error } = await supa.from('calendars').select('id, name, owner_id')
  if (error) throw error
  const { data: memberships } = await supa.from('calendar_members').select('calendar_id, role').eq('user_id', user.id)
  const roleOf = new Map((memberships ?? []).map((m: any) => [m.calendar_id, m.role]))
  return (cals ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    role: c.owner_id === user.id ? 'owner' : (roleOf.get(c.id) ?? 'reader'),
  }))
}

async function busyOf(supa: SupabaseClient, calId: string, from: Date, to: Date): Promise<Interval[]> {
  const { data, error } = await supa.rpc('calendar_busy', {
    cal: calId, win_start: from.toISOString(), win_end: to.toISOString(),
  })
  if (error) throw error
  return (data ?? []).map((r: any) => ({ start: Date.parse(r.starts_at), end: Date.parse(r.ends_at) }))
}

function windowOf(fromIso: unknown, toIso: unknown): { from: Date; to: Date } {
  const from = new Date(String(fromIso))
  const to = new Date(String(toIso))
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) throw new Error('invalid time window')
  if (to.getTime() - from.getTime() > MAX_WINDOW_DAYS * 86400_000) throw new Error(`window longer than ${MAX_WINDOW_DAYS} days`)
  return { from, to }
}

function validTimeZone(tz: unknown): string {
  try {
    if (typeof tz === 'string') { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz }
  } catch { /* fall through */ }
  return 'UTC'
}

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v)
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const toIso = (i: Interval) => ({ start: new Date(i.start).toISOString(), end: new Date(i.end).toISOString() })

// ---- JSON-RPC helpers ----

// Reads the client_id claim of a JWT. The signature was already checked by getUser(); this only reads the payload.
function oauthClientId(token: string): string | null {
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64url(token.split('.')[1])))
    return typeof payload.client_id === 'string' && payload.client_id ? payload.client_id : null
  } catch {
    return null
  }
}
function base64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function rpcResult(id: unknown, result: unknown) {
  return json({ jsonrpc: '2.0', id, result })
}
function rpcError(id: unknown, code: number, message: string) {
  return json({ jsonrpc: '2.0', id, error: { code, message } })
}
function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, ...extra, 'Content-Type': 'application/json' },
  })
}
