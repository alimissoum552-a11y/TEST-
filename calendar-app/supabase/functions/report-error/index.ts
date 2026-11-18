// Errors of the web app (window error and unhandled promise rejection), sent by src/lib/errorReporter.js.
// Public (deployed with --no-verify-jwt): the text is scrubbed and cut, and one address can send 30 reports an hour.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { scrub } from '../_shared/scrub.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const MAX_PER_HOUR = 30

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  try {
    const raw = await req.text()
    if (raw.length > 8000) return json({ error: 'too_large' }, 413)
    const body = JSON.parse(raw || '{}')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const address = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ops:' + address + (Deno.env.get('CRON_SECRET') ?? '')))
    const who = Array.from(new Uint8Array(digest)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await admin.from('ops_errors').select('id', { count: 'exact', head: true })
      .eq('source', 'web').gte('at', since).eq('detail->>who', who)
    if ((count ?? 0) >= MAX_PER_HOUR) return json({ ok: true, dropped: true })

    await admin.from('ops_errors').insert({
      source: 'web',
      code: scrub(body?.kind ?? 'error', 40),
      message: scrub(body?.message),
      detail: { who, route: scrub(body?.route, 100), stack: scrub(body?.stack, 800), agent: scrub(req.headers.get('user-agent'), 160), release: scrub(body?.release, 40) },
    })
    return json({ ok: true })
  } catch (_e) {
    return json({ error: 'bad_request' }, 400)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
