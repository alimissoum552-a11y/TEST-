// Creates (or reuses) the Stripe products, prices, education coupon, customer-portal configuration and webhook endpoint
// for the paid plans listed in the `plans` table. Safe to run again: prices are found by lookup key.
//
//   STRIPE_BILLING_API_KEY=sk_test_... node scripts/stripe-billing-setup.mjs
//
// The same script runs against the live key at launch. It prints the webhook signing secret only when it creates the
// endpoint (Stripe shows it once): store it as the Supabase secret STRIPE_BILLING_WEBHOOK_SECRET.
const KEY = process.env.STRIPE_BILLING_API_KEY
const SUPABASE = process.env.SUPABASE_URL || 'https://oybvllumenwbzekgxjtz.supabase.co'
const ANON = process.env.SUPABASE_ANON_KEY
const WEBHOOK_URL = `${SUPABASE}/functions/v1/billing`
if (!KEY) throw new Error('STRIPE_BILLING_API_KEY is required')
if (!ANON) throw new Error('SUPABASE_ANON_KEY is required (the plans table is public)')

const enc = (o, p = '') => Object.entries(o).flatMap(([k, v]) => {
  if (v === undefined || v === null) return []
  const key = p ? `${p}[${k}]` : k
  if (Array.isArray(v)) return v.flatMap((x, i) => (typeof x === 'object' ? enc(x, `${key}[${i}]`) : [`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(x)}`]))
  if (typeof v === 'object') return enc(v, key)
  return [`${encodeURIComponent(key)}=${encodeURIComponent(v)}`]
})
async function stripe(path, params, method = 'POST') {
  const q = method === 'GET' && params ? '?' + enc(params).join('&') : ''
  const res = await fetch(`https://api.stripe.com/v1${path}${q}`, {
    method, headers: { Authorization: `Bearer ${KEY}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: method === 'POST' ? enc(params ?? {}).join('&') : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${path}: ${data?.error?.message}`)
  return data
}

const plansRes = await fetch(`${SUPABASE}/rest/v1/plans?select=*&order=sort`, { headers: { apikey: ANON } })
const plans = (await plansRes.json()).filter((p) => p.price_month_cents > 0)
const productIds = {}, priceIdsByPlan = {}

for (const plan of plans) {
  let product = (await stripe('/products', { limit: 100, active: true }, 'GET')).data.find((p) => p.metadata?.plan_code === plan.code)
  // Stripe Tax needs a tax code on the product: SaaS, personal use for consumer plans, business use for the work plan.
  const taxCode = plan.price_includes_tax ? 'txcd_10103000' : 'txcd_10103001'
  if (!product) product = await stripe('/products', { name: `Collyo ${plan.name}`, tax_code: taxCode, metadata: { plan_code: plan.code } })
  else if (product.tax_code !== taxCode) product = await stripe(`/products/${product.id}`, { tax_code: taxCode })
  productIds[plan.code] = product.id
  priceIdsByPlan[plan.code] = []
  for (const [interval, cents] of [['month', plan.price_month_cents], ['year', plan.price_year_cents]]) {
    const key = `${plan.code}_${interval}`
    const found = (await stripe('/prices', { lookup_keys: [key], active: true }, 'GET')).data[0]
    if (found) { priceIdsByPlan[plan.code].push(found.id); console.log('exists ', key, found.id, found.unit_amount); continue }
    const price = await stripe('/prices', {
      product: product.id, currency: 'eur', unit_amount: cents, lookup_key: key,
      recurring: { interval }, tax_behavior: plan.price_includes_tax ? 'inclusive' : 'exclusive',
    })
    priceIdsByPlan[plan.code].push(price.id); console.log('created', key, price.id, cents)
  }
}

// Education: 50 % off, handed out as a promotion code after the teacher is verified.
const coupons = await stripe('/coupons', { limit: 100 }, 'GET')
if (!coupons.data.find((c) => c.id === 'edu_50')) { await stripe('/coupons', { id: 'edu_50', percent_off: 50, duration: 'forever', name: 'Education 50%' }); console.log('created coupon edu_50') }

// Customer portal: cancel, change plan or seats (prorated), card, invoices.
const configs = await stripe('/billing_portal/configurations', { limit: 10 }, 'GET')
if (!configs.data.find((c) => c.metadata?.collyo === '1')) {
  await stripe('/billing_portal/configurations', {
    metadata: { collyo: '1' },
    business_profile: { headline: 'Collyo subscription' },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email', 'name', 'address', 'tax_id'] },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true, default_allowed_updates: ['price', 'quantity'], proration_behavior: 'create_prorations',
        products: plans.map((p) => ({ product: productIds[p.code], prices: priceIdsByPlan[p.code] })),
      },
    },
  }).catch(async () => {
    // Fallback without plan switching if Stripe rejects the product list.
    await stripe('/billing_portal/configurations', { metadata: { collyo: '1' }, business_profile: { headline: 'Collyo subscription' },
      features: { invoice_history: { enabled: true }, payment_method_update: { enabled: true }, subscription_cancel: { enabled: true, mode: 'at_period_end' } } })
  })
  console.log('created portal configuration')
}

const hooks = await stripe('/webhook_endpoints', { limit: 100 }, 'GET')
const hook = hooks.data.find((h) => h.url === WEBHOOK_URL)
if (hook) console.log('webhook exists', hook.id)
else {
  const created = await stripe('/webhook_endpoints', {
    url: WEBHOOK_URL, description: 'Collyo billing',
    enabled_events: ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.payment_failed', 'invoice.paid'],
  })
  console.log('created webhook', created.id)
  await setSecrets({ STRIPE_BILLING_WEBHOOK_SECRET: created.secret })
}
if (process.argv.includes('--set-secrets')) await setSecrets({ STRIPE_BILLING_API_KEY: KEY })

// Stores secrets in the Supabase project through the Management API, without ever printing them.
async function setSecrets(values) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) { console.log('SUPABASE_ACCESS_TOKEN not set: set', Object.keys(values).join(', '), 'yourself.'); return }
  const ref = new URL(SUPABASE).hostname.split('.')[0]
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.entries(values).map(([name, value]) => ({ name, value }))),
  })
  console.log(res.ok ? 'stored secrets:' : `could not store secrets (${res.status}):`, Object.keys(values).join(', '))
}
