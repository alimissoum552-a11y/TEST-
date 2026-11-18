// "Founding club" offer (docs/GROWTH.md): Team (groups) free for 6 months, one code per club, usable once, valid 60 days.
// The club enters the code on the Stripe payment page ("Add promotion code"); nothing is charged for 6 months, then the
// normal price applies unless the club cancels from "Manage or cancel my subscription".
//
//   STRIPE_BILLING_API_KEY=<live key> node scripts/founder-code.mjs "FC Porto Juniors"
//
// The coupon is created the first time. The code is printed: send it to the club.
const KEY = process.env.STRIPE_BILLING_API_KEY
const club = process.argv.slice(2).join(' ').trim()
if (!KEY) throw new Error('STRIPE_BILLING_API_KEY is required')
if (!club) throw new Error('usage: node scripts/founder-code.mjs "<club name>"')
const COUPON = 'founder_club_6m'

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
  if (!res.ok) throw Object.assign(new Error(`${path}: ${data?.error?.message}`), { code: data?.error?.code })
  return data
}

const product = (await stripe('/products', { limit: 100, active: true }, 'GET')).data.find((p) => p.metadata?.plan_code === 'team_groups')
if (!product) throw new Error('Team (groups) product not found: run scripts/stripe-billing-setup.mjs first')
try { await stripe(`/coupons/${COUPON}`, undefined, 'GET') } catch {
  await stripe('/coupons', { id: COUPON, name: 'Founding club: 6 months free', percent_off: 100, duration: 'repeating', duration_in_months: 6, applies_to: { products: [product.id] } })
  console.log('created coupon', COUPON)
}
const slug = club.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12) || 'CLUB'
const suffix = Array.from(crypto.getRandomValues(new Uint8Array(3))).map((b) => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('')
const promo = await stripe('/promotion_codes', {
  promotion: { type: 'coupon', coupon: COUPON },
  code: `CLUB-${slug}-${suffix}`, max_redemptions: 1,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 86400,
  metadata: { club, offer: 'founding_club' },
}).catch(async (e) => {
  // Older API versions take `coupon` at the top level.
  if (!/promotion/.test(e.message)) throw e
  return stripe('/promotion_codes', { coupon: COUPON, code: `CLUB-${slug}-${suffix}`, max_redemptions: 1, expires_at: Math.floor(Date.now() / 1000) + 60 * 86400, metadata: { club, offer: 'founding_club' } })
})
console.log(`${LIVE()} code for "${club}": ${promo.code} (single use, valid until ${new Date(promo.expires_at * 1000).toISOString().slice(0, 10)})`)
function LIVE() { return /^(sk|rk)_live_/.test(KEY) ? 'LIVE' : 'TEST' }
