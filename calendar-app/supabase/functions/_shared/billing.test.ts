import { describe, it, expect } from 'vitest'
import { lookupKey, parseLookupKey, validateCheckout, mapStripeStatus, subscriptionRow, formEncode, nextSubscriptionRow, refundAllowed, refundWindowDays } from './billing.ts'

const min = (p: string) => (p === 'team_work' ? 3 : 1)

describe('lookup keys', () => {
  it('round-trips and rejects anything that is not one of the paid plans', () => {
    expect(lookupKey('pro', 'year')).toBe('pro_year')
    expect(parseLookupKey('team_groups_month')).toEqual({ plan: 'team_groups', interval: 'month' })
    for (const bad of ['free_month', 'launch_year', 'pro', 'pro_week', '', null, undefined, 'PRO_month']) expect(parseLookupKey(bad), String(bad)).toBeNull()
  })
})

describe('validateCheckout', () => {
  it('accepts a paid plan and interval', () => {
    expect(validateCheckout({ plan: 'pro', interval: 'month' }, min)).toEqual({ ok: true, plan: 'pro', interval: 'month', seats: 1 })
  })
  it('refuses the free and launch plans, unknown plans and bad intervals', () => {
    expect(validateCheckout({ plan: 'free', interval: 'month' }, min)).toEqual({ ok: false, error: 'invalid_plan' })
    expect(validateCheckout({ plan: 'launch', interval: 'month' }, min)).toMatchObject({ ok: false })
    expect(validateCheckout({ plan: 'pro', interval: 'week' }, min)).toEqual({ ok: false, error: 'invalid_interval' })
  })
  it('ignores seats on plans that are not per seat, and enforces the minimum on the work plan', () => {
    expect(validateCheckout({ plan: 'pro', interval: 'year', seats: 40 }, min)).toMatchObject({ ok: true, seats: 1 })
    expect(validateCheckout({ plan: 'team_work', interval: 'month' }, min)).toMatchObject({ ok: true, seats: 3 })
    expect(validateCheckout({ plan: 'team_work', interval: 'month', seats: 2 }, min)).toEqual({ ok: false, error: 'invalid_seats' })
    expect(validateCheckout({ plan: 'team_work', interval: 'month', seats: 12 }, min)).toMatchObject({ ok: true, seats: 12 })
    expect(validateCheckout({ plan: 'team_work', interval: 'month', seats: 501 }, min)).toEqual({ ok: false, error: 'invalid_seats' })
    expect(validateCheckout({ plan: 'team_work', interval: 'month', seats: 3.5 }, min)).toEqual({ ok: false, error: 'invalid_seats' })
  })
})

describe('mapStripeStatus', () => {
  it('maps the statuses and ignores an unfinished payment', () => {
    expect(mapStripeStatus('active')).toBe('active')
    expect(mapStripeStatus('past_due')).toBe('past_due')
    expect(mapStripeStatus('canceled')).toBe('canceled')
    expect(mapStripeStatus('unpaid')).toBe('canceled')
    expect(mapStripeStatus('incomplete')).toBeNull()
  })
})

describe('subscriptionRow', () => {
  const sub = (over: any = {}) => ({
    id: 'sub_1', status: 'active', customer: 'cus_1',
    items: { data: [{ quantity: 1, current_period_end: 1800000000, price: { lookup_key: 'pro_month' } }] }, ...over,
  })
  it('reads the plan, status, period end and ids', () => {
    expect(subscriptionRow(sub())).toEqual({
      plan_code: 'pro', status: 'active', seats: 1, current_period_end: new Date(1800000000 * 1000).toISOString(),
      cancel_at: null, started_at: null, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1',
    })
  })
  it('uses the quantity as seats only on the work plan', () => {
    const work = sub({ items: { data: [{ quantity: 7, price: { lookup_key: 'team_work_year' } }] } })
    expect(subscriptionRow(work)?.seats).toBe(7)
    expect(subscriptionRow(sub({ items: { data: [{ quantity: 7, price: { lookup_key: 'pro_year' } }] } }))?.seats).toBe(1)
  })
  it('returns null for a price that is not ours or an unfinished payment', () => {
    expect(subscriptionRow(sub({ items: { data: [{ price: { lookup_key: 'something_else' } }] } }))).toBeNull()
    expect(subscriptionRow(sub({ status: 'incomplete' }))).toBeNull()
    expect(subscriptionRow({})).toBeNull()
  })
  it('accepts an expanded customer object', () => {
    expect(subscriptionRow(sub({ customer: { id: 'cus_9' } }))?.stripe_customer_id).toBe('cus_9')
  })
})

describe('formEncode', () => {
  it('uses bracket notation for nested objects and arrays', () => {
    const out = formEncode({ mode: 'subscription', line_items: [{ price: 'price_1', quantity: 3, adjustable_quantity: { enabled: true, minimum: 3 } }], metadata: { user_id: 'u 1' }, skip: undefined })
    expect(out).toContain('mode=subscription')
    expect(out).toContain(encodeURIComponent('line_items[0][price]') + '=price_1')
    expect(out).toContain(encodeURIComponent('line_items[0][adjustable_quantity][enabled]') + '=true')
    expect(out).toContain(encodeURIComponent('metadata[user_id]') + '=u%201')
    expect(out.join('&')).not.toContain('skip')
  })
})

describe('cancellation date', () => {
  it('reads cancel_at, or the period end when cancel_at_period_end is set', () => {
    const base = { id: 's', status: 'active', customer: 'c', start_date: 1790000000, items: { data: [{ current_period_end: 1800000000, price: { lookup_key: 'pro_month' } }] } }
    expect(subscriptionRow({ ...base, cancel_at: 1799000000 })?.cancel_at).toBe(new Date(1799000000 * 1000).toISOString())
    expect(subscriptionRow({ ...base, cancel_at_period_end: true })?.cancel_at).toBe(new Date(1800000000 * 1000).toISOString())
    expect(subscriptionRow(base)?.cancel_at).toBeNull()
    expect(subscriptionRow(base)?.started_at).toBe(new Date(1790000000 * 1000).toISOString())
  })
})

describe('nextSubscriptionRow', () => {
  const row = (status: any) => ({ plan_code: 'starter' as const, status, seats: 1, current_period_end: 'x', cancel_at: null, started_at: 's', stripe_customer_id: 'cus', stripe_subscription_id: 'sub' })
  it('remembers the plan the account had before paying', () => {
    expect(nextSubscriptionRow({ plan_code: 'launch', source: 'launch' }, row('active'))).toMatchObject({ plan_code: 'starter', source: 'stripe', plan_before_stripe: 'launch' })
    expect(nextSubscriptionRow({ plan_code: 'free', source: 'launch' }, row('active')).plan_before_stripe).toBe('free')
    expect(nextSubscriptionRow(null, row('active')).plan_before_stripe).toBe('free')
  })
  it('keeps the remembered plan across updates of a running subscription', () => {
    expect(nextSubscriptionRow({ plan_code: 'starter', source: 'stripe', plan_before_stripe: 'launch' }, row('past_due')).plan_before_stripe).toBe('launch')
  })
  it('goes back to the previous plan when the subscription ends, never to a paid one', () => {
    expect(nextSubscriptionRow({ plan_code: 'starter', source: 'stripe', plan_before_stripe: 'launch' }, row('canceled'))).toMatchObject({ plan_code: 'launch', status: 'active', source: 'launch', stripe_subscription_id: null, stripe_customer_id: 'cus' })
    expect(nextSubscriptionRow({ plan_code: 'starter', source: 'stripe', plan_before_stripe: null }, row('canceled'))).toMatchObject({ plan_code: 'free', source: 'manual' })
    expect(nextSubscriptionRow({ plan_code: 'pro', source: 'manual' }, row('canceled')).plan_code).toBe('free')
  })
})

describe('refund window', () => {
  const now = new Date('2026-11-30T00:00:00Z')
  it('is 14 days for consumer plans and 30 for the work plan', () => {
    expect(refundWindowDays('starter')).toBe(14)
    expect(refundWindowDays('team_work')).toBe(30)
    expect(refundAllowed('pro', '2026-11-17T00:00:00Z', now)).toBe(true)
    expect(refundAllowed('pro', '2026-11-15T00:00:00Z', now)).toBe(false)
    expect(refundAllowed('team_work', '2026-11-05T00:00:00Z', now)).toBe(true)
    expect(refundAllowed('pro', null, now)).toBe(false)
  })
})
