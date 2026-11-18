// Stripe Billing (docs/PRICING.md): subscriptions for the paid plans.
//   checkout : the signed-in user starts a Checkout session for a plan and an interval (returns the Stripe URL).
//   portal   : the signed-in user opens the Stripe customer portal (change plan, cancel, invoices, card).
//   webhook  : Stripe tells us the subscription changed (Stripe-Signature header); we read the subscription from Stripe
//              and write the `subscriptions` row. Reading it again from Stripe makes the order of events irrelevant.
// Deployed with --no-verify-jwt (the webhook has no session); the user actions check the session themselves.
// Secrets: STRIPE_BILLING_API_KEY (test key now, live key at launch), STRIPE_BILLING_WEBHOOK_SECRET, APP_URL.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyStripeSignature } from '../identity/stripe.ts'
import { validateCheckout, subscriptionRow, lookupKey, formEncode, MAX_SEATS } from '../_shared/billing.ts'

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
    if (!stripeKey()) return json({ error: 'billing_not_configured' }, 503)

    const body = await req.json().catch(() => ({}))
    if (body?.action === 'checkout') return await checkout(admin, user, body)
    if (body?.action === 'portal') return await portal(admin, user)
    return json({ error: 'unknown_action' }, 400)
  } catch (_e) {
    return json({ error: 'server_error' }, 500)
  }
})

const stripeKey = () => Deno.env.get('STRIPE_BILLING_API_KEY') ?? ''
const appUrl = () => (Deno.env.get('APP_URL') ?? 'https://collyo.app').replace(/\/+$/, '')

async function stripe(path: string, params?: Record<string, unknown>, method: 'GET' | 'POST' = 'POST'): Promise<any> {
  const query = method === 'GET' && params ? '?' + formEncode(params).join('&') : ''
  const res = await fetch(`${STRIPE}${path}${query}`, {
    method,
    headers: { Authorization: `Bearer ${stripeKey()}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: method === 'POST' ? formEncode(params ?? {}).join('&') : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data?.error?.message ?? 'stripe_error'), { stripe: data?.error })
  return data
}

async function checkout(admin: any, user: any, body: any): Promise<Response> {
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
    const c = await stripe('/customers', { email: user.email, metadata: { user_id: user.id } })
    customer = c.id
    await admin.from('subscriptions').update({ stripe_customer_id: customer, updated_at: new Date().toISOString() }).eq('user_id', user.id)
  }

  const prices = await stripe('/prices', { lookup_keys: [lookupKey(v.plan, v.interval)], active: true, limit: 1 }, 'GET')
  const price = prices?.data?.[0]
  if (!price) return json({ error: 'price_not_found' }, 404)

  const session = await stripe('/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{
      price: price.id, quantity: v.seats,
      ...(v.plan === 'team_work' ? { adjustable_quantity: { enabled: true, minimum: minSeats.get('team_work') ?? 3, maximum: MAX_SEATS } } : {}),
    }],
    subscription_data: { metadata: { user_id: user.id, plan_code: v.plan } },
    metadata: { user_id: user.id, plan_code: v.plan },
    allow_promotion_codes: true,
    // Collyo is the seller, not Stripe: Managed Payments (Stripe as merchant of record, +3.5 %) is switched off for these sessions,
    // and prices are charged in euros as on the pricing page. docs/PRICING.md, "Who sells".
    managed_payments: { enabled: false },
    adaptive_pricing: { enabled: false },
    // VAT: computed by Stripe Tax from the customer's address. Businesses can enter their VAT number (reverse charge).
    automatic_tax: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    tax_id_collection: { enabled: true },
    success_url: `${appUrl()}/#/billing?status=success`,
    cancel_url: `${appUrl()}/#/pricing`,
  })
  return json({ url: session.url })
}

async function portal(admin: any, user: any): Promise<Response> {
  const { data: sub } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle()
  if (!sub?.stripe_customer_id) return json({ error: 'no_customer' }, 404)
  const session = await stripe('/billing_portal/sessions', { customer: sub.stripe_customer_id, return_url: `${appUrl()}/` })
  return json({ url: session.url })
}

async function webhook(req: Request, admin: any, signature: string): Promise<Response> {
  const payload = await req.text()
  const ok = await verifyStripeSignature(payload, signature, Deno.env.get('STRIPE_BILLING_WEBHOOK_SECRET') ?? '')
  if (!ok) return json({ error: 'bad_signature' }, 400)

  const event = JSON.parse(payload)
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
  const sub = await stripe(`/subscriptions/${encodeURIComponent(subId)}`, { expand: ['items.data.price'] }, 'GET')
  const row = subscriptionRow(sub)
  if (!row) return json({ ok: true, ignored: true })

  const customerId = row.stripe_customer_id
  let userId: string | null = sub?.metadata?.user_id ?? null
  if (!userId) {
    const { data: byCustomer } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle()
    userId = byCustomer?.user_id ?? null
  }
  if (!userId) return json({ ok: true, ignored: true })

  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId, ...row, source: 'stripe', updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) return json({ error: 'db_error' }, 500) // Stripe retries
  return json({ ok: true })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
