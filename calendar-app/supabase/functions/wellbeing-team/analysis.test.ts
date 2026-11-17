import { describe, it, expect } from 'vitest'
import { hoursByDay, overloadedDays, clampThreshold, parseReview } from './analysis.ts'

const ev = (s: string, e: string, all_day = false) => ({ starts_at: s, ends_at: e, all_day })

describe('meeting load per day', () => {
  it('sums hours of timed events on the same UTC day', () => {
    const h = hoursByDay([ev('2026-11-18T09:00:00Z', '2026-11-18T10:30:00Z'), ev('2026-11-18T13:00:00Z', '2026-11-18T14:00:00Z')])
    expect(h.get('2026-11-18')).toBeCloseTo(2.5)
  })

  it('splits an event that crosses midnight between the two days', () => {
    const h = hoursByDay([ev('2026-11-18T23:00:00Z', '2026-11-19T01:00:00Z')])
    expect(h.get('2026-11-18')).toBeCloseTo(1)
    expect(h.get('2026-11-19')).toBeCloseTo(1)
  })

  it('ignores all-day events and invalid ranges', () => {
    const h = hoursByDay([ev('2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z', true), ev('2026-11-18T10:00:00Z', '2026-11-18T09:00:00Z')])
    expect(h.size).toBe(0)
  })

  it('flags only days strictly above the threshold, in date order', () => {
    const events = [
      ev('2026-11-20T09:00:00Z', '2026-11-20T13:00:00Z'), // 4 h
      ev('2026-11-18T09:00:00Z', '2026-11-18T12:00:00Z'), // 3 h, not above 3
      ev('2026-11-19T09:00:00Z', '2026-11-19T12:30:00Z'), // 3.5 h
    ]
    expect(overloadedDays(events, 3)).toEqual([{ day: '2026-11-19', hours: 3.5 }, { day: '2026-11-20', hours: 4 }])
  })
})

describe('threshold', () => {
  it('defaults to 3 hours and stays within 1 to 12', () => {
    expect(clampThreshold(undefined)).toBe(3)
    expect(clampThreshold('abc')).toBe(3)
    expect(clampThreshold(0)).toBe(1)
    expect(clampThreshold(40)).toBe(12)
    expect(clampThreshold('4.5')).toBe(4.5)
  })
})

describe('model answer', () => {
  it('keeps valid crisis signals and drops bad indexes or kinds', () => {
    const text = '{"signals":[{"index":2,"kind":"crisis"},{"index":9,"kind":"crisis"},{"index":1,"kind":"distress"}],"tension":true,"overload":false}'
    expect(parseReview(text, 3)).toEqual({ signals: [{ index: 2, kind: 'crisis' }], tension: true, overload: false })
  })

  it('returns null when no JSON object is present', () => {
    expect(parseReview('no json here', 3)).toBeNull()
    expect(parseReview('{broken', 3)).toBeNull()
  })

  it('treats missing flags as false', () => {
    expect(parseReview('{"signals":[]}', 3)).toEqual({ signals: [], tension: false, overload: false })
  })
})
