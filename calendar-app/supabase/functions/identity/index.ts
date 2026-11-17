// Identity verification of the calendar creator (Stripe Identity). Only creators of family, sports or class
// calendars need it; other members never go through here (docs/FAMILY_TEAM.md, section 4).
// Two entry points, told apart by the Stripe-Signature header:
//   - the app (user JWT) starts a verification session and gets the Stripe-hosted page address;
//   - Stripe (signed webhook, deployed with --no-verify-jwt) reports the result.
// Stored: status, verified name, country, session id. Never the document, the selfie or the date of birth.
// Secrets: STRIPE_API_KEY (dedicated Collyo Stripe account), STRIPE_WEBHOOK_SECRET. Provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyStripeSignature, verifiedNameOf } from './stripe.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const signature = req.headers.get('stripe-signature')

    if (signature) return await handleWebhook(req, admin, signature)
    const body = await req.clone().json().catch(() => ({}))
    if (body?.action === 'refresh') return await handleRefresh(req, admin)
    return await handleStart(req, admin)
  } catch (_e) {
    return json({ error: 'server_error' }, 500)
  }
})

async function handleStart(req: Request, admin: any): Promise<Response> {
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  // Stripe secret key of the dedicated Collyo account (test or live mode, decided by the key itself).
  const secret = Deno.env.get('STRIPE_API_KEY')
  if (!secret) return json({ error: 'identity_not_configured' }, 503)

  // Already verified: nothing to do.
  const { data: current } = await admin.from('identity_verifications').select('status').eq('user_id', user.id).maybeSingle()
  if (current?.status === 'verified') return json({ status: 'verified' })

  const form = new URLSearchParams()
  form.set('type', 'document')
  form.set('metadata[user_id]', user.id)
  form.set('options[document][require_matching_selfie]', 'true')
  form.set('options[document][require_live_capture]', 'true')
  form.set('return_url', 'https://collyo.app/')
  const res = await fetch('https://api.stripe.com/v1/identity/verification_sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  if (!res.ok) {
    // Stripe's error type, code and message are safe to show to the calendar owner and make failures diagnosable.
    const body = await res.json().catch(() => ({}))
    const e = body?.error ?? {}
    return json({
      error: 'identity_unavailable',
      stripe_error: { type: e.type ?? null, code: e.code ?? null, message: String(e.message ?? '').slice(0, 300) },
    }, 502)
  }
  const session = await res.json()

  await admin.from('identity_verifications').upsert({
    user_id: user.id, status: 'pending', stripe_session_id: session.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  return json({ status: 'pending', url: session.url })
}

async function handleWebhook(req: Request, admin: any, signature: string): Promise<Response> {
  const payload = await req.text()
  const ok = await verifyStripeSignature(payload, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '')
  if (!ok) return json({ error: 'bad_signature' }, 400)

  const event = JSON.parse(payload)
  const session = event?.data?.object
  const userId = session?.metadata?.user_id
  if (!userId) return json({ ok: true, ignored: true })

  if (event.type === 'identity.verification_session.verified') {
    // The event does not carry the verified data: read it from Stripe with the key of the dedicated account.
    let detail = session
    const key = Deno.env.get('STRIPE_API_KEY')
    if (!verifiedNameOf(session) && key) detail = (await fetchWithOutputs(key, session.id)) ?? session
    await admin.from('identity_verifications').upsert({
      user_id: userId, status: 'verified', stripe_session_id: session.id,
      verified_name: verifiedNameOf(detail), country: detail?.verified_outputs?.address?.country ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  } else if (event.type === 'identity.verification_session.requires_input' || event.type === 'identity.verification_session.canceled') {
    await admin.from('identity_verifications').upsert({
      user_id: userId, status: 'failed', stripe_session_id: session.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }
  return json({ ok: true })
}

// Reads a verification session together with its verified outputs (name, country). Only the name and country are kept.
async function fetchWithOutputs(secret: string, sessionId: string): Promise<any | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/identity/verification_sessions/${encodeURIComponent(sessionId)}?expand[]=verified_outputs`,
    { headers: { Authorization: `Bearer ${secret}` } },
  )
  return res.ok ? await res.json() : null
}

// A signed-in user whose verification succeeded but whose name was not stored (earlier webhook) asks for a refresh.
// Only the session recorded for that user is read; nothing comes from the request.
async function handleRefresh(req: Request, admin: any): Promise<Response> {
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  const key = Deno.env.get('STRIPE_API_KEY')
  if (!key) return json({ error: 'identity_not_configured' }, 503)

  const { data: row } = await admin.from('identity_verifications')
    .select('status, stripe_session_id, verified_name').eq('user_id', user.id).maybeSingle()
  if (!row?.stripe_session_id) return json({ status: row?.status ?? 'none' })
  if (row.status !== 'verified' || row.verified_name) return json({ status: row.status, verified_name: !!row.verified_name })

  const detail = await fetchWithOutputs(key, row.stripe_session_id)
  const name = detail ? verifiedNameOf(detail) : null
  if (!name) return json({ error: 'identity_unavailable', stripe_error: { message: 'verified name not available' } }, 502)
  await admin.from('identity_verifications').update({
    verified_name: name, country: detail?.verified_outputs?.address?.country ?? null, updated_at: new Date().toISOString(),
  }).eq('user_id', user.id)
  return json({ status: 'verified', verified_name: true })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
