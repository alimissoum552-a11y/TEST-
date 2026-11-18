import { describe, it, expect } from 'vitest'
import { meterState, monthStartIso } from './plans.js'

const plan = (o = {}) => ({ ai_enabled: true, ai_monthly_requests: 150, ai_per_seat: false, ...o })

describe('meterState', () => {
  it('shows no AI for a plan without it, a missing plan or a canceled subscription', () => {
    expect(meterState(plan({ ai_enabled: false, ai_monthly_requests: 0 }), 'active', 1, 0).kind).toBe('none')
    expect(meterState(null, 'active', 1, 0).kind).toBe('none')
    expect(meterState(plan(), 'canceled', 1, 12).kind).toBe('none')
  })
  it('is unlimited on the launch plan', () => {
    expect(meterState(plan({ ai_monthly_requests: null }), 'active', 1, 321)).toMatchObject({ kind: 'unlimited', used: 321, limit: null })
  })
  it('gives used, limit and a percentage capped at 100', () => {
    expect(meterState(plan(), 'active', 1, 42)).toEqual({ kind: 'limited', used: 42, limit: 150, percent: 28 })
    expect(meterState(plan(), 'active', 1, 400).percent).toBe(100)
  })
  it('multiplies the quota by the seats on a per-seat plan', () => {
    expect(meterState(plan({ ai_monthly_requests: 300, ai_per_seat: true }), 'active', 4, 0).limit).toBe(1200)
  })
})

describe('monthStartIso', () => {
  it('is the first instant of the UTC month', () => {
    expect(monthStartIso(new Date('2026-11-30T23:00:00Z'))).toBe('2026-11-01T00:00:00.000Z')
  })
})
