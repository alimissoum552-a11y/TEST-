import { describe, it, expect } from 'vitest'
import { lookupKey, parseLookupKey, validateCheckout, mapStripeStatus, subscriptionRow, formEncode } from './billing.ts'

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
      stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1',
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
