// AI assistant: answers questions about the caller's calendars and proposes free times. Read-only.
// Runs with the caller's JWT, so Row Level Security decides what is visible. Only availability (busy times)
// is read from calendars the caller does not own. Secrets: ANTHROPIC_API_KEY. Provided by Supabase: SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { findFreeSlots, type Interval } from './slots.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL = 'claude-sonnet-5-5'
const MAX_TOOL_ROUNDS = 6
const MAX_MESSAGES = 20
const MAX_CHARS = 2000
const MAX_WINDOW_DAYS = 62
// Safety cap on requests per user per day. Not a price: prices will be set from ai_usage.
const DAILY_REQUEST_CAP = 60

const TOOLS = [
  {
    name: 'list_calendars',
    description: 'List the calendars the user can access, with their id, name, role, and whether they are shared.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_my_events',
    description: "List the events (with titles) of one of the user's OWN calendars in a time window. Not for shared calendars.",
    input_schema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'string' },
        from: { type: 'string', description: 'ISO 8601 start, e.g. 2026-11-16T00:00:00Z' },
        to: { type: 'string', description: 'ISO 8601 end, exclusive' },
      },
      required: ['calendar_id', 'from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_busy_times',
    description: 'Busy time ranges of any accessible calendar, shared ones included. Titles are never returned.',
    input_schema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
      required: ['calendar_id', 'from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'find_free_slots',
    description: 'Free windows of at least the given duration, inside working hours, when all the listed calendars are free. Always use this for scheduling; never compute times yourself.',
    input_schema: {
      type: 'object',
      properties: {
        calendar_ids: { type: 'array', items: { type: 'string' }, description: 'Calendars of all the people who must attend.' },
        from: { type: 'string' },
        to: { type: 'string' },
        duration_minutes: { type: 'integer', minimum: 5, maximum: 480 },
        work_start_hour: { type: 'integer', minimum: 0, maximum: 23, description: 'Local hour, default 9.' },
        work_end_hour: { type: 'integer', minimum: 1, maximum: 24, description: 'Local hour, default 18.' },
      },
      required: ['calendar_ids', 'from', 'to', 'duration_minutes'],
      additionalProperties: false,
    },
  },
]


// Write tools. Each one is only offered to the model when the user enabled the
// matching permission in the AI panel, and each write runs with the caller's JWT,
// so row-level security still decides what is actually possible.
const WRITE_TOOLS: Record<string, any> = {
  create_event: {
    name: 'create_event',
    description: 'Create an event. Only use it when the user clearly asks for a new event.',
    input_schema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'string' },
        title: { type: 'string' },
        starts_at: { type: 'string', description: 'ISO 8601 with time zone, e.g. 2026-11-18T09:00:00Z' },
        ends_at: { type: 'string' },
        description: { type: 'string' },
        location: { type: 'string' },
      },
      required: ['calendar_id', 'title', 'starts_at', 'ends_at'],
      additionalProperties: false,
    },
  },
  update_event: {
    name: 'update_event',
    description: 'Change an existing event (move it, rename it, edit details). Only when the user asks.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string' },
        title: { type: 'string' },
        starts_at: { type: 'string' },
        ends_at: { type: 'string' },
        description: { type: 'string' },
        location: { type: 'string' },
      },
      required: ['event_id'],
      additionalProperties: false,
    },
  },
  delete_event: {
    name: 'delete_event',
    description: 'Delete an event. Only when the user explicitly asks to remove it.',
    input_schema: {
      type: 'object',
      properties: { event_id: { type: 'string' } },
      required: ['event_id'],
      additionalProperties: false,
    },
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'assistant_not_configured' }, 503)

    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => null)
    const messages = sanitizeMessages(body?.messages)
    if (!messages) return json({ error: 'invalid_messages' }, 400)
    const timeZone = validTimeZone(body?.timezone)
    const locale = typeof body?.locale === 'string' ? body.locale.slice(0, 10) : 'en'

    // The user must have accepted the assistant policy (shown in the app before first use).
    const { data: profile } = await supa.from('profiles').select('ai_accepted_at').eq('id', user.id).maybeSingle()
    if (!profile?.ai_accepted_at) return json({ error: 'consent_required' }, 403)

    // What the user allowed the assistant to do. Everything is off unless opted in.
    const { data: permRow } = await supa.from('ai_permissions')
      .select('can_create, can_update, can_delete').eq('user_id', user.id).maybeSingle()
    const allowed = { create: !!permRow?.can_create, update: !!permRow?.can_update, delete: !!permRow?.can_delete }
    const tools = [...TOOLS, ...Object.entries(allowed).filter(([, ok]) => ok).map(([k]) => WRITE_TOOLS[k + '_event'])]

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()
    const { count } = await admin.from('ai_usage').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', since)
    if ((count ?? 0) >= DAILY_REQUEST_CAP) return json({ error: 'daily_limit' }, 429)

    // Calendars the caller can access. Ownership decides whether titles may be read.
    const cals = await accessibleCalendars(supa, user.id)
    const byId = new Map(cals.map((c) => [c.id, c]))
    const consulted = new Set<string>()
    const applied: { action: string; id: string; title: string }[] = []
    let toolCalls = 0

    const system = systemPrompt({ now: new Date(), timeZone, locale, allowed })
    const convo: any[] = messages.map((m) => ({ role: m.role, content: m.content }))
    let inputTokens = 0
    let outputTokens = 0

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, tools, messages: convo }),
      })
      if (!res.ok) return json({ error: 'model_unavailable' }, 502)
      const r = await res.json()
      inputTokens += r.usage?.input_tokens ?? 0
      outputTokens += r.usage?.output_tokens ?? 0

      if (r.stop_reason === 'tool_use') {
        convo.push({ role: 'assistant', content: r.content })
        const results = []
        for (const block of r.content.filter((b: any) => b.type === 'tool_use')) {
          toolCalls++
          const out = await runTool(block.name, block.input ?? {}, { supa, byId, consulted, timeZone, allowed, applied })
          results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) })
        }
        convo.push({ role: 'user', content: results })
        continue
      }

      await admin.from('ai_usage').insert({
        user_id: user.id, model: MODEL, input_tokens: inputTokens, output_tokens: outputTokens, tool_calls: toolCalls,
      })
      const reply = r.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
      return json({ reply, consulted: [...consulted], applied })
    }
    return json({ error: 'too_many_steps' }, 500)
  } catch (e) {
    return json({ error: 'server_error' }, 500)
  }
})

// ---- tools ----

async function runTool(
  name: string,
  input: any,
  ctx: {
    supa: SupabaseClient
    byId: Map<string, Cal>
    consulted: Set<string>
    timeZone: string
    allowed: { create: boolean; update: boolean; delete: boolean }
    applied: { action: string; id: string; title: string }[]
  },
): Promise<unknown> {
  try {
    if (name === 'list_calendars') {
      return [...ctx.byId.values()].map((c) => ({ id: c.id, name: c.name, role: c.role, shared: c.role !== 'owner' }))
    }
    if (name === 'list_my_events') {
      const c = calendarFor(ctx, input.calendar_id)
      if (c.role !== 'owner') return { error: 'Titles are only available for your own calendars. Use get_busy_times.' }
      const { from, to } = window(input.from, input.to)
      const { data, error } = await ctx.supa.from('events')
        .select('id, title, starts_at, ends_at, location').eq('calendar_id', c.id)
        .gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString())
        .order('starts_at').limit(200)
      if (error) throw error
      return data
    }
    if (name === 'get_busy_times') {
      const c = calendarFor(ctx, input.calendar_id)
      const { from, to } = window(input.from, input.to)
      return { calendar: c.name, busy: (await busyOf(ctx.supa, c.id, from, to)).map(toIso) }
    }
    if (name === 'find_free_slots') {
      const ids: string[] = Array.isArray(input.calendar_ids) ? input.calendar_ids : []
      if (!ids.length) return { error: 'calendar_ids is empty' }
      const { from, to } = window(input.from, input.to)
      const busy: Interval[] = []
      for (const id of ids) {
        const c = calendarFor(ctx, id)
        busy.push(...(await busyOf(ctx.supa, c.id, from, to)))
      }
      const slots = findFreeSlots({
        busy, from: from.getTime(), to: to.getTime(), timeZone: ctx.timeZone,
        durationMs: Number(input.duration_minutes) * 60_000,
        startHour: clampInt(input.work_start_hour, 9, 0, 23),
        endHour: clampInt(input.work_end_hour, 18, 1, 24),
      })
      return { duration_minutes: input.duration_minutes, slots: slots.map(toIso) }
    }
    if (name === 'create_event') {
      if (!ctx.allowed.create) return { error: 'permission_disabled', permission: 'create' }
      const c = calendarFor(ctx, input.calendar_id)
      const range = eventRange(input.starts_at, input.ends_at)
      if ('error' in range) return range
      const { data, error } = await ctx.supa.from('events').insert({
        calendar_id: c.id,
        owner_id: (await ctx.supa.auth.getUser()).data.user?.id,
        title: cleanText(input.title, 200),
        description: cleanText(input.description, 2000) || null,
        location: cleanText(input.location, 200) || null,
        starts_at: range.start, ends_at: range.end,
      }).select('id, title').single()
      if (error) return { error: error.message }
      ctx.applied.push({ action: 'create', id: data.id, title: data.title })
      return { created: { id: data.id, title: data.title, calendar: c.name } }
    }
    if (name === 'update_event') {
      if (!ctx.allowed.update) return { error: 'permission_disabled', permission: 'update' }
      const patch: Record<string, unknown> = {}
      if (input.title !== undefined) patch.title = cleanText(input.title, 200)
      if (input.description !== undefined) patch.description = cleanText(input.description, 2000) || null
      if (input.location !== undefined) patch.location = cleanText(input.location, 200) || null
      if (input.starts_at !== undefined || input.ends_at !== undefined) {
        const range = eventRange(input.starts_at, input.ends_at, true)
        if ('error' in range) return range
        if (range.start) patch.starts_at = range.start
        if (range.end) patch.ends_at = range.end
      }
      if (!Object.keys(patch).length) return { error: 'nothing to update' }
      const { data, error } = await ctx.supa.from('events').update(patch)
        .eq('id', String(input.event_id)).select('id, title').maybeSingle()
      if (error) return { error: error.message }
      if (!data) return { error: 'event not accessible' }
      ctx.applied.push({ action: 'update', id: data.id, title: data.title })
      return { updated: { id: data.id, title: data.title } }
    }
    if (name === 'delete_event') {
      if (!ctx.allowed.delete) return { error: 'permission_disabled', permission: 'delete' }
      const { data, error } = await ctx.supa.from('events').delete()
        .eq('id', String(input.event_id)).select('id, title').maybeSingle()
      if (error) return { error: error.message }
      if (!data) return { error: 'event not accessible' }
      ctx.applied.push({ action: 'delete', id: data.id, title: data.title })
      return { deleted: { id: data.id, title: data.title } }
    }
    return { error: `unknown tool ${name}` }
  } catch (e) {
    return { error: (e as Error).message || 'tool_failed' }
  }
}

type Cal = { id: string; name: string; role: string }

function calendarFor(ctx: { byId: Map<string, Cal>; consulted: Set<string> }, id: unknown): Cal {
  const c = ctx.byId.get(String(id))
  if (!c) throw new Error('calendar not accessible')
  ctx.consulted.add(c.name)
  return c
}

async function accessibleCalendars(supa: SupabaseClient, userId: string): Promise<Cal[]> {
  const { data: cals, error } = await supa.from('calendars').select('id, name, owner_id')
  if (error) throw error
  const { data: memberships } = await supa.from('calendar_members').select('calendar_id, role').eq('user_id', userId)
  const roleOf = new Map((memberships ?? []).map((m: any) => [m.calendar_id, m.role]))
  return (cals ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    role: c.owner_id === userId ? 'owner' : (roleOf.get(c.id) ?? 'reader'),
  }))
}

async function busyOf(supa: SupabaseClient, calId: string, from: Date, to: Date): Promise<Interval[]> {
  const { data, error } = await supa.rpc('calendar_busy', {
    cal: calId, win_start: from.toISOString(), win_end: to.toISOString(),
  })
  if (error) throw error
  return (data ?? []).map((r: any) => ({ start: Date.parse(r.starts_at), end: Date.parse(r.ends_at) }))
}

function window(fromIso: unknown, toIso: unknown): { from: Date; to: Date } {
  const from = new Date(String(fromIso))
  const to = new Date(String(toIso))
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) throw new Error('invalid time window')
  if (to.getTime() - from.getTime() > MAX_WINDOW_DAYS * 86400_000) throw new Error(`window longer than ${MAX_WINDOW_DAYS} days`)
  return { from, to }
}

// ---- helpers ----

function sanitizeMessages(input: unknown): { role: 'user' | 'assistant'; content: string }[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MESSAGES) return null
  const out: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of input) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null
    if (!m.content.trim() || m.content.length > MAX_CHARS) return null
    out.push({ role: m.role, content: m.content })
  }
  if (out[out.length - 1].role !== 'user') return null
  return out
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

const toIso = (i: { start: number; end: number } | Interval) => ({
  start: new Date(i.start).toISOString(),
  end: new Date(i.end).toISOString(),
})

function systemPrompt(p: { now: Date; timeZone: string; locale: string; allowed: { create: boolean; update: boolean; delete: boolean } }): string {
  const powers = [
    p.allowed.create && 'create events',
    p.allowed.update && 'move or edit events',
    p.allowed.delete && 'delete events',
  ].filter(Boolean) as string[]
  const rights = powers.length
    ? `The user allowed you to ${powers.join(', ')}. Do it only when the user clearly asks for that change, and report exactly what you changed.`
    : 'You cannot create, move or delete events: the user has not enabled any write permission. Propose the change in text and tell the user they can enable it in the AI settings (gear icon).'
  return [
    'You are the scheduling assistant of a calendar application.',
    `Current time: ${p.now.toISOString()} (UTC). The user's time zone is ${p.timeZone}. Reply in the user's language (locale: ${p.locale}).`,
    'Rules:',
    `- ${rights}`,
    '- Never claim to have changed something you did not change with a tool.',
    '- Use the tools for any fact about the calendars. Never invent events, titles or times.',
    '- For scheduling, call find_free_slots; for shared calendars you only see busy times, never titles.',
    '- Explain briefly why a slot works (which calendars were checked, working hours used).',
    '- If the tools return no slot, say so and suggest a wider window or a shorter duration.',
    '- Keep answers short and concrete. Times are shown in the user time zone.',
  ].join('\n')
}

function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

// Validates an event range. On update, both bounds may be omitted.
function eventRange(a: unknown, b: unknown, partial = false): { start?: string; end?: string; error?: string } {
  const start = a === undefined ? undefined : new Date(String(a))
  const end = b === undefined ? undefined : new Date(String(b))
  if (start && isNaN(start.getTime())) return { error: 'invalid starts_at' }
  if (end && isNaN(end.getTime())) return { error: 'invalid ends_at' }
  if (start && end && end <= start) return { error: 'ends_at must be after starts_at' }
  if (!partial && (!start || !end)) return { error: 'starts_at and ends_at are required' }
  return { start: start?.toISOString(), end: end?.toISOString() }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
