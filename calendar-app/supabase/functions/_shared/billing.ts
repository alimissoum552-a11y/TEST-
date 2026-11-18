// Pure helpers for Stripe Billing (docs/PRICING.md). No network, so they can be tested.
// A Stripe price is found by its lookup key "<plan>_<interval>" (starter_month, pro_year, ...): the same keys exist in
// test and live mode, so no price id is stored in the code or in the database.

export const PAID_PLANS = ['starter', 'pro', 'team_groups', 'team_work'] as const
export type PaidPlan = typeof PAID_PLANS[number]
export type Interval = 'month' | 'year'
export const MAX_SEATS = 500

export const lookupKey = (plan: PaidPlan, interval: Interval): string => `${plan}_${interval}`

export function parseLookupKey(key: unknown): { plan: PaidPlan; interval: Interval } | null {
  const m = String(key ?? '').match(/^([a-z_]+)_(month|year)$/)
  if (!m || !(PAID_PLANS as readonly string[]).includes(m[1])) return null
  return { plan: m[1] as PaidPlan, interval: m[2] as Interval }
}

// What the app may ask for. Seats only count for the per-seat plan, with its minimum.
export function validateCheckout(body: any, minSeatsOf: (plan: string) => number):
  { ok: true; plan: PaidPlan; interval: Interval; seats: number } | { ok: false; error: string } {
  const plan = String(body?.plan ?? '')
  const interval = String(body?.interval ?? '')
  if (!(PAID_PLANS as readonly string[]).includes(plan)) return { ok: false, error: 'invalid_plan' }
  if (interval !== 'month' && interval !== 'year') return { ok: false, error: 'invalid_interval' }
  if (plan !== 'team_work') return { ok: true, plan: plan as PaidPlan, interval, seats: 1 }
  const min = minSeatsOf(plan)
  const seats = body?.seats === undefined ? min : Number(body.seats)
  if (!Number.isInteger(seats) || seats < min || seats > MAX_SEATS) return { ok: false, error: 'invalid_seats' }
  return { ok: true, plan: plan as PaidPlan, interval, seats }
}

// Stripe subscription status -> ours. null = ignore the event (the payment is not finished).
export function mapStripeStatus(status: string): 'active' | 'trialing' | 'past_due' | 'canceled' | null {
  switch (status) {
    case 'active': return 'active'
    case 'trialing': return 'trialing'
    case 'past_due': return 'past_due'
    case 'canceled': case 'unpaid': case 'incomplete_expired': case 'paused': return 'canceled'
    default: return null // incomplete
  }
}

// Fields to store for a Stripe subscription object (with items.data[].price expanded). null when it is not one of our plans.
export function subscriptionRow(sub: any): null | {
  plan_code: PaidPlan; status: 'active' | 'trialing' | 'past_due' | 'canceled'; seats: number
  current_period_end: string | null; stripe_customer_id: string; stripe_subscription_id: string
} {
  const status = mapStripeStatus(String(sub?.status ?? ''))
  const item = sub?.items?.data?.[0]
  const parsed = parseLookupKey(item?.price?.lookup_key)
  if (!status || !parsed) return null
  const end = Number(item?.current_period_end ?? sub?.current_period_end)
  return {
    plan_code: parsed.plan,
    status,
    seats: parsed.plan === 'team_work' ? Math.max(1, Number(item?.quantity) || 1) : 1,
    current_period_end: Number.isFinite(end) && end > 0 ? new Date(end * 1000).toISOString() : null,
    stripe_customer_id: String(typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? ''),
    stripe_subscription_id: String(sub.id),
  }
}

// Stripe expects application/x-www-form-urlencoded with bracket notation for nested values.
export function formEncode(value: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined || v === null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (Array.isArray(v)) v.forEach((item, i) => {
      if (item !== null && typeof item === 'object') out.push(...formEncode(item as Record<string, unknown>, `${key}[${i}]`))
      else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`)
    })
    else if (typeof v === 'object') out.push(...formEncode(v as Record<string, unknown>, key))
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`)
  }
  return out
}
