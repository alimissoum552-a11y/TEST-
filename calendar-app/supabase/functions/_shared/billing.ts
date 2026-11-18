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
export type StripeRow = {
  plan_code: PaidPlan; status: 'active' | 'trialing' | 'past_due' | 'canceled'; seats: number
  current_period_end: string | null; cancel_at: string | null; started_at: string | null
  stripe_customer_id: string; stripe_subscription_id: string
}

export function subscriptionRow(sub: any): null | StripeRow {
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
    cancel_at: isoOrNull(sub?.cancel_at ?? (sub?.cancel_at_period_end ? end : null)),
    started_at: isoOrNull(sub?.start_date),
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

const isoOrNull = (t: unknown): string | null => {
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null
}

// What to write in `subscriptions` for a Stripe subscription, given the account's current row.
// While the subscription runs, the paid plan applies and the plan the account had before (launch or free) is kept.
// When it has ended, the account goes back to that plan; a paid plan is never restored.
export function nextSubscriptionRow(existing: { plan_code?: string | null; source?: string | null; plan_before_stripe?: string | null } | null, row: StripeRow) {
  const before = existing?.source === 'stripe'
    ? (existing?.plan_before_stripe ?? 'free')
    : (existing?.plan_code && !(PAID_PLANS as readonly string[]).includes(existing.plan_code) ? existing.plan_code : 'free')
  if (row.status === 'canceled') {
    return {
      plan_code: before, status: 'active' as const, source: before === 'launch' ? 'launch' : 'manual', seats: 1,
      current_period_end: null, cancel_at: null, started_at: null, stripe_subscription_id: null,
      stripe_customer_id: row.stripe_customer_id, plan_before_stripe: null,
    }
  }
  return { ...row, source: 'stripe', plan_before_stripe: before }
}

// Refund window, counted from the start of the paid subscription: the legal 14-day withdrawal for consumers,
// 30 days for work teams (terms, section 12).
export function refundWindowDays(plan: string): number {
  return plan === 'team_work' ? 30 : 14
}
export function refundAllowed(plan: string, startedAtIso: string | null, now: Date = new Date()): boolean {
  if (!startedAtIso) return false
  const started = Date.parse(startedAtIso)
  return Number.isFinite(started) && now.getTime() - started <= refundWindowDays(plan) * 86400_000
}

// A Stripe event is written only for an account that still exists. When an account is deleted, its profile and its
// subscriptions row are gone, and the later customer.subscription.deleted event has nothing to update.
export function webhookTargetExists(profile: { id?: string | null } | null | undefined): boolean {
  return !!profile?.id
}
