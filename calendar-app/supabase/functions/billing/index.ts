// Stripe Billing (docs/PRICING.md): subscriptions for the paid plans.
//   checkout : the signed-in user starts a Checkout session for a plan and an interval (returns the Stripe URL).
//   portal   : the signed-in user opens the Stripe customer portal (change plan, cancel, invoices, card).
//   refund   : within 14 days of the start (30 for work teams), refunds the payment and ends the subscription now.
//   webhook  : Stripe tells us the subscription changed (Stripe-Signature header); we read the subscription from Stripe
//              and write the `subscriptions` row. Reading it again from Stripe makes the order of events irrelevant.
// Deployed with --no-verify-jwt (the webhook has no session); the user actions check the session themselves.
// Two Stripe modes live side by side. BILLING_MODE ('test' by default, 'live' at launch) decides which one the app's
// checkout and portal use. Webhooks are verified with the secret of the mode they come from (event.livemode).
// Secrets: STRIPE_BILLING_API_KEY + STRIPE_BILLING_WEBHOOK_SECRET (test), STRIPE_BILLING_LIVE_API_KEY +
// STRIPE_BILLING_LIVE_WEBHOOK_SECRET (live), BILLING_MODE, APP_URL.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyStripeSignature } from '../identity/stripe.ts'
import { EDUCATION_PLANS, EDUCATION_COUPON } from '../_shared/education.ts'
import { validateCheckout, subscriptionRow, nextSubscriptionRow, refundAllowed, lookupKey, formEncode, MAX_SEATS, webhookTargetExists } from '../_shared/billing.ts'
import { reportError } from '../_shared/ops.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}
const STRIPE = 'https://api.stripe.com/v1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const signature = req.headers.get('stripe-signature')
    if (signature) return await webhook(req, admin, signature)

    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)
    const key = keyFor(currentMode())
    if (!key) return json({ error: 'billing_not_configured' }, 503)

    const body = await req.json().catch(() => ({}))
    if (body?.action === 'checkout') return await checkout(admin, user, body, key)
    if (body?.action === 'portal') return await portal(admin, user, key)
    if (body?.action === 'refund') return await refund(admin, user)
    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    await reportError('billing', e)
    return json({ error: 'server_error' }, 500)
  }
})

type Mode = 'test' | 'live'
const currentMode = (): Mode => (Deno.env.get('BILLING_MODE') === 'live' ? 'live' : 'test')
const keyFor = (mode: Mode) => Deno.env.get(mode === 'live' ? 'STRIPE_BILLING_LIVE_API_KEY' : 'STRIPE_BILLING_API_KEY') ?? ''
const webhookSecretFor = (mode: Mode) => Deno.env.get(mode === 'live' ? 'STRIPE_BILLING_LIVE_WEBHOOK_SECRET' : 'STRIPE_BILLING_WEBHOOK_SECRET') ?? ''
const appUrl = () => (Deno.env.get('APP_URL') ?? 'https://collyo.app').replace(/\/+$/, '')

async function stripe(key: string, path: string, params?: Record<string, unknown>, method: 'GET' | 'POST' | 'DELETE' = 'POST'): Promise<any> {
  const query = method === 'GET' && params ? '?' + formEncode(params).join('&') : ''
  const res = await fetch(`${STRIPE}${path}${query}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: method === 'POST' ? formEncode(params ?? {}).join('&') : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data?.error?.message ?? 'stripe_error'), { stripe: data?.error })
  return data
}

async function checkout(admin: any, user: any, body: any, key: string): Promise<Response> {
  const { data: me } = await admin.from('profiles').select('account_type').eq('id', user.id).maybeSingle()
  if (me?.account_type === 'minor') return json({ error: 'not_allowed' }, 403)

  const { data: plans } = await admin.from('plans').select('code, min_seats')
  const minSeats = new Map((plans ?? []).map((p: any) => [p.code, Number(p.min_seats) || 1]))
  const v = validateCheckout(body, (p) => minSeats.get(p) ?? 1)
  if (!v.ok) return json({ error: v.error }, 400)

  const { data: sub } = await admin.from('subscriptions')
    .select('source, status, stripe_customer_id, stripe_subscription_id').eq('user_id', user.id).maybeSingle()
  // One subscription per account: changing plan goes through the portal.
  if (sub?.source === 'stripe' && sub.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status)) {
    return json({ error: 'already_subscribed' }, 409)
  }

  let customer = sub?.stripe_customer_id as string | null
  if (!customer) {
    const c = await stripe(key, '/customers', { email: user.email, metadata: { user_id: user.id } })
    customer = c.id
    await admin.from('subscriptions').update({ stripe_customer_id: customer, updated_at: new Date().toISOString() }).eq('user_id', user.id)
  }

  const prices = await stripe(key, '/prices', { lookup_keys: [lookupKey(v.plan, v.interval)], active: true, limit: 1 }, 'GET')
  const price = prices?.data?.[0]
  if (!price) return json({ error: 'price_not_found' }, 404)

  // Approved teachers: the education coupon is applied directly (no code to type) on the plans it covers.
  const { data: edu } = await admin.from('education_requests').select('status').eq('user_id', user.id).maybeSingle()
  const education = edu?.status === 'approved' && EDUCATION_PLANS.includes(v.plan)

  const session = await stripe(key, '/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{
      price: price.id, quantity: v.seats,
      ...(v.plan === 'team_work' ? { adjustable_quantity: { enabled: true, minimum: minSeats.get('team_work') ?? 3, maximum: MAX_SEATS } } : {}),
    }],
    subscription_data: { metadata: { user_id: user.id, plan_code: v.plan } },
    metadata: { user_id: user.id, plan_code: v.plan },
    ...(education ? { discounts: [{ coupon: EDUCATION_COUPON }] } : { allow_promotion_codes: true }),
    // Managed Payments stays on (account default): Stripe is the merchant of record and handles VAT. docs/PRICING.md, "Who sells".
    // VAT: computed by Stripe Tax from the customer's address. Businesses can enter their VAT number (reverse charge).
    automatic_tax: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    tax_id_collection: { enabled: true },
    success_url: `${appUrl()}/#/billing?status=success`,
    cancel_url: `${appUrl()}/#/pricing`,
  })
  return json({ url: session.url })
}

async function portal(admin: any, user: any, key: string): Promise<Response> {
  const { data: sub } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle()
  if (!sub?.stripe_customer_id) return json({ error: 'no_customer' }, 404)
  const session = await stripe(key, '/billing_portal/sessions', { customer: sub.stripe_customer_id, return_url: `${appUrl()}/` })
  return json({ url: session.url })
}

// Self-service refund inside the withdrawal window: the payments of this subscription are refunded and it ends now.
// The webhook then puts the account back on its previous plan.
async function refund(admin: any, user: any): Promise<Response> {
  const { data: sub } = await admin.from('subscriptions')
    .select('plan_code, source, status, started_at, stripe_customer_id, stripe_subscription_id').eq('user_id', user.id).maybeSingle()
  if (!sub || sub.source !== 'stripe' || !sub.stripe_subscription_id) return json({ error: 'no_subscription' }, 404)
  if (!refundAllowed(sub.plan_code, sub.started_at)) return json({ error: 'refund_window_passed' }, 403)

  // The subscription may belong to the live or the test mode (accounts created while testing): use the mode that knows it.
  let key = ''
  for (const mode of [currentMode(), currentMode() === 'live' ? 'test' : 'live'] as Mode[]) {
    const k = keyFor(mode)
    if (!k) continue
    try { await stripe(k, `/subscriptions/${encodeURIComponent(sub.stripe_subscription_id)}`, undefined, 'GET'); key = k; break } catch { /* not in this mode */ }
  }
  if (!key) return json({ error: 'no_subscription' }, 404)

  const startedSec = Math.floor(Date.parse(sub.started_at) / 1000)
  const charges = await stripe(key, '/charges', { customer: sub.stripe_customer_id, limit: 10, created: { gte: startedSec - 3600 } }, 'GET')
  let refunded = 0
  for (const c of charges?.data ?? []) {
    if (!c.paid || c.refunded || c.amount_refunded >= c.amount) continue
    await stripe(key, '/refunds', { charge: c.id, reason: 'requested_by_customer', metadata: { user_id: user.id } })
    refunded += c.amount - c.amount_refunded
  }
  await stripe(key, `/subscriptions/${encodeURIComponent(sub.stripe_subscription_id)}`, undefined, 'DELETE')
  return json({ ok: true, refunded_cents: refunded })
}

async function webhook(req: Request, admin: any, signature: string): Promise<Response> {
  const payload = await req.text()
  // The mode only chooses which secret the signature must match: a forged event cannot pass either way.
  let parsed: any = null
  try { parsed = JSON.parse(payload) } catch { return json({ error: 'bad_payload' }, 400) }
  const mode: Mode = parsed?.livemode === true ? 'live' : 'test'
  const ok = await verifyStripeSignature(payload, signature, webhookSecretFor(mode))
  if (!ok) return json({ error: 'bad_signature' }, 400)

  const event = parsed
  const obj = event?.data?.object
  let subId: string | null = null
  switch (event?.type) {
    case 'checkout.session.completed': subId = typeof obj?.subscription === 'string' ? obj.subscription : obj?.subscription?.id ?? null; break
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': subId = obj?.id ?? null; break
    case 'invoice.payment_failed':
    case 'invoice.paid': subId = typeof obj?.subscription === 'string' ? obj.subscription : obj?.subscription?.id ?? null; break
    default: return json({ ok: true, ignored: true })
  }
  if (!subId) return json({ ok: true, ignored: true })

  // Read the subscription again: the event may be old or out of order, Stripe's copy is the truth.
  const sub = await stripe(keyFor(mode), `/subscriptions/${encodeURIComponent(subId)}`, { expand: ['items.data.price'] }, 'GET')
  const row = subscriptionRow(sub)
  if (!row) return json({ ok: true, ignored: true })

  const customerId = row.stripe_customer_id
  let userId: string | null = sub?.metadata?.user_id ?? null
  if (!userId) {
    const { data: byCustomer } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle()
    userId = byCustomer?.user_id ?? null
  }
  if (!userId) return json({ ok: true, ignored: true })

  // The account may have been deleted (its subscriptions row goes with the profile): Stripe then cancels the
  // subscription and tells us. Nothing is left to update, so acknowledge instead of failing and making Stripe retry.
  const { data: profile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!webhookTargetExists(profile)) return json({ ok: true, ignored: 'no_profile' })

  // While it runs: the paid plan. When it has ended: back to the plan the account had before (launch or free).
  const { data: existing } = await admin.from('subscriptions').select('plan_code, source, plan_before_stripe').eq('user_id', userId).maybeSingle()
  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId, ...nextSubscriptionRow(existing, row), updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) { await reportError('billing-webhook', error, { event: event?.type }); return json({ error: 'db_error' }, 500) } // Stripe retries
  return json({ ok: true })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
