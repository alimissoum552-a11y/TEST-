import { describe, it, expect } from 'vitest'
import { mergeIntervals, subtractBusy, zonedToUtc, workWindows, findFreeSlots } from './slots.ts'

const H = 3600_000
const at = (iso: string) => Date.parse(iso)

describe('mergeIntervals', () => {
  it('merges overlapping and touching intervals, drops empty ones', () => {
    const out = mergeIntervals([
      { start: 10, end: 20 }, { start: 15, end: 30 }, { start: 30, end: 40 }, { start: 50, end: 50 },
    ])
    expect(out).toEqual([{ start: 10, end: 40 }])
  })
})

describe('subtractBusy', () => {
  it('returns the gaps around busy blocks', () => {
    const window = { start: 9 * H, end: 17 * H }
    const busy = [{ start: 10 * H, end: 11 * H }, { start: 12 * H, end: 13 * H }]
    expect(subtractBusy(window, busy)).toEqual([
      { start: 9 * H, end: 10 * H }, { start: 11 * H, end: 12 * H }, { start: 13 * H, end: 17 * H },
    ])
  })
  it('ignores busy blocks outside the window', () => {
    const window = { start: 9 * H, end: 10 * H }
    expect(subtractBusy(window, [{ start: 0, end: 8 * H }, { start: 11 * H, end: 12 * H }]))
      .toEqual([{ start: 9 * H, end: 10 * H }])
  })
})

describe('zonedToUtc', () => {
  it('Lisbon in November is UTC+0', () => {
    expect(zonedToUtc(2026, 11, 16, 9, 0, 'Europe/Lisbon')).toBe(at('2026-11-16T09:00:00Z'))
  })
  it('Paris in November is UTC+1', () => {
    expect(zonedToUtc(2026, 11, 16, 9, 0, 'Europe/Paris')).toBe(at('2026-11-16T08:00:00Z'))
  })
  it('Paris before the spring change (29 March 2026) is UTC+1, after it UTC+2', () => {
    expect(zonedToUtc(2026, 3, 28, 9, 0, 'Europe/Paris')).toBe(at('2026-03-28T08:00:00Z'))
    expect(zonedToUtc(2026, 3, 30, 9, 0, 'Europe/Paris')).toBe(at('2026-03-30T07:00:00Z'))
  })
})

describe('workWindows', () => {
  it('gives one window per local day, in local hours', () => {
    const from = at('2026-11-16T00:00:00Z')
    const to = at('2026-11-18T00:00:00Z')
    const w = workWindows(from, to, 'Europe/Paris', 9, 18)
    expect(w).toEqual([
      { start: at('2026-11-16T08:00:00Z'), end: at('2026-11-16T17:00:00Z') },
      { start: at('2026-11-17T08:00:00Z'), end: at('2026-11-17T17:00:00Z') },
    ])
  })
})

describe('findFreeSlots', () => {
  const tz = 'Europe/Lisbon'
  const from = at('2026-11-16T00:00:00Z')
  const to = at('2026-11-17T00:00:00Z')

  it('finds a slot long enough for the meeting, outside busy times', () => {
    const busy = [
      { start: at('2026-11-16T09:00:00Z'), end: at('2026-11-16T10:30:00Z') },
      { start: at('2026-11-16T11:00:00Z'), end: at('2026-11-16T17:00:00Z') },
    ]
    const slots = findFreeSlots({ busy, from, to, timeZone: tz, durationMs: H, startHour: 9, endHour: 18 })
    // The 30-minute gap (10:30-11:00) is too short for a 1h meeting, so only the evening slot remains.
    expect(slots.every((s) => s.end - s.start >= H)).toBe(true)
    expect(slots).toEqual([{ start: at('2026-11-16T17:00:00Z'), end: at('2026-11-16T18:00:00Z') }])
  })

  it('returns no slot when the whole day is busy', () => {
    const busy = [{ start: at('2026-11-16T00:00:00Z'), end: at('2026-11-17T00:00:00Z') }]
    expect(findFreeSlots({ busy, from, to, timeZone: tz, durationMs: H, startHour: 9, endHour: 18 })).toEqual([])
  })

  it('never proposes times outside working hours', () => {
    const slots = findFreeSlots({ busy: [], from, to, timeZone: tz, durationMs: H, startHour: 9, endHour: 18 })
    for (const s of slots) {
      expect(s.start).toBeGreaterThanOrEqual(at('2026-11-16T09:00:00Z'))
      expect(s.end).toBeLessThanOrEqual(at('2026-11-16T18:00:00Z'))
    }
  })
})
