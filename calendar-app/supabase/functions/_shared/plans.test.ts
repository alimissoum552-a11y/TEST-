import { describe, it, expect } from 'vitest'
import { aiVerdict, startOfMonthUtc, type Plan } from './plans.ts'

const plan = (over: Partial<Plan> = {}): Plan => ({ code: 'x', ai_enabled: true, ai_monthly_requests: 50, ai_per_seat: false, ...over })

describe('aiVerdict', () => {
  it('refuses the AI on a plan without it', () => {
    expect(aiVerdict(plan({ ai_enabled: false, ai_monthly_requests: 0 }), 'active', 1, 0)).toEqual({ ok: false, error: 'plan_required', limit: 0 })
  })
  it('treats a missing plan or a canceled subscription as no AI', () => {
    expect(aiVerdict(null, 'active', 1, 0).ok).toBe(false)
    expect(aiVerdict(plan(), 'canceled', 1, 0)).toMatchObject({ ok: false, error: 'plan_required' })
  })
  it('allows requests until the monthly limit, then stops', () => {
    expect(aiVerdict(plan(), 'active', 1, 49)).toEqual({ ok: true, limit: 50 })
    expect(aiVerdict(plan(), 'active', 1, 50)).toEqual({ ok: false, error: 'quota_reached', limit: 50 })
    expect(aiVerdict(plan(), 'active', 1, 400)).toMatchObject({ ok: false, error: 'quota_reached' })
  })
  it('has no monthly limit when the plan has none (launch)', () => {
    expect(aiVerdict(plan({ ai_monthly_requests: null }), 'active', 1, 100000)).toEqual({ ok: true, limit: null })
  })
  it('multiplies a per-seat quota by the seats and never by less than one', () => {
    const seat = plan({ ai_monthly_requests: 300, ai_per_seat: true })
    expect(aiVerdict(seat, 'active', 3, 899)).toEqual({ ok: true, limit: 900 })
    expect(aiVerdict(seat, 'active', 3, 900)).toMatchObject({ ok: false, error: 'quota_reached', limit: 900 })
    expect(aiVerdict(seat, 'active', 0, 0)).toEqual({ ok: true, limit: 300 })
  })
  it('keeps serving a past-due subscription (grace period)', () => {
    expect(aiVerdict(plan(), 'past_due', 1, 0).ok).toBe(true)
  })
})

describe('startOfMonthUtc', () => {
  it('is the first instant of the UTC month', () => {
    expect(startOfMonthUtc(new Date('2026-11-18T23:59:00Z'))).toBe('2026-11-01T00:00:00.000Z')
    expect(startOfMonthUtc(new Date('2027-01-01T00:00:00Z'))).toBe('2027-01-01T00:00:00.000Z')
  })
})
