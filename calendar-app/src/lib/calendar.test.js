import { describe, it, expect } from 'vitest'
import {
  dateKey, parseKey, addDays, addMonths, startOfWeek, weekDays, monthGrid, isSameMonth,
} from './calendar.js'

describe('dateKey / parseKey', () => {
  it('round-trips a local date', () => {
    expect(dateKey(new Date(2026, 10, 5))).toBe('2026-11-05')
    expect(dateKey(parseKey('2026-11-05'))).toBe('2026-11-05')
  })
})

describe('addMonths', () => {
  it('keeps the day when the target month is long enough', () => {
    expect(dateKey(addMonths(new Date(2026, 10, 16), 1))).toBe('2026-12-16')
  })
  it('clamps to the last day of a shorter month', () => {
    expect(dateKey(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28')
    expect(dateKey(addMonths(new Date(2028, 0, 31), 1))).toBe('2028-02-29')
  })
  it('goes backwards across the year boundary', () => {
    expect(dateKey(addMonths(new Date(2026, 0, 10), -1))).toBe('2025-12-10')
  })
})

describe('startOfWeek', () => {
  it('starts on Monday', () => {
    // 16 Nov 2026 is a Monday, 22 Nov is a Sunday
    expect(dateKey(startOfWeek(new Date(2026, 10, 16)))).toBe('2026-11-16')
    expect(dateKey(startOfWeek(new Date(2026, 10, 22)))).toBe('2026-11-16')
  })
  it('handles Sunday as the last day of the week', () => {
    expect(dateKey(startOfWeek(new Date(2026, 10, 15)))).toBe('2026-11-09')
  })
})

describe('weekDays', () => {
  it('returns seven consecutive days from Monday', () => {
    const days = weekDays(new Date(2026, 10, 18)).map(dateKey)
    expect(days).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
      '2026-11-20', '2026-11-21', '2026-11-22',
    ])
  })
})

describe('monthGrid', () => {
  it('always has 42 cells, Monday-first, covering the whole month', () => {
    for (const [y, m] of [[2026, 8], [2026, 10], [2026, 1], [2027, 1]]) {
      const grid = monthGrid(new Date(y, m, 1))
      expect(grid).toHaveLength(42)
      expect(grid[0].getDay()).toBe(1) // Monday
      const days = grid.filter((d) => isSameMonth(d, new Date(y, m, 1)))
      expect(days).toHaveLength(new Date(y, m + 1, 0).getDate())
    }
  })
  it('November 2026 starts on the Monday 26 October', () => {
    const grid = monthGrid(new Date(2026, 10, 1))
    expect(dateKey(grid[0])).toBe('2026-10-26')
    expect(dateKey(grid[6])).toBe('2026-11-01')
  })
  it('February 2026 fits exactly in four rows', () => {
    // 1 Feb 2026 is a Sunday, so the grid starts on Monday 26 Jan
    expect(dateKey(monthGrid(new Date(2026, 1, 1))[0])).toBe('2026-01-26')
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(dateKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01')
    expect(dateKey(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28')
  })
})
