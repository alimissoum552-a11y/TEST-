// Scheduling helpers. Pure functions: no I/O and no model. All times are epoch milliseconds.
// The assistant calls these through tools, so the times it proposes are computed, not guessed.

export type Interval = { start: number; end: number }

// Sorts and merges overlapping or touching intervals.
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start)
  const out: Interval[] = []
  for (const i of sorted) {
    const last = out[out.length - 1]
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end)
    else out.push({ start: i.start, end: i.end })
  }
  return out
}

// The parts of `window` that no busy interval covers.
export function subtractBusy(window: Interval, busy: Interval[]): Interval[] {
  const free: Interval[] = []
  let cursor = window.start
  for (const b of mergeIntervals(busy)) {
    if (b.end <= cursor) continue
    if (b.start >= window.end) break
    if (b.start > cursor) free.push({ start: cursor, end: Math.min(b.start, window.end) })
    cursor = Math.max(cursor, b.end)
    if (cursor >= window.end) break
  }
  if (cursor < window.end) free.push({ start: cursor, end: window.end })
  return free
}

// Offset of a time zone at an instant, in milliseconds (local wall time minus UTC).
export function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const asUtc = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second)
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

// Converts a wall-clock time in a time zone to an instant. Handles daylight saving changes.
export function zonedToUtc(y: number, m: number, d: number, hour: number, minute: number, timeZone: string): number {
  const guess = Date.UTC(y, m - 1, d, hour, minute)
  const t1 = guess - tzOffsetMs(guess, timeZone)
  return guess - tzOffsetMs(t1, timeZone)
}

// Working-hours windows for each local day that overlaps [from, to).
export function workWindows(from: number, to: number, timeZone: string, startHour: number, endHour: number): Interval[] {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(from))
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  let y = +v.year, m = +v.month, d = +v.day
  const out: Interval[] = []
  for (let guard = 0; guard < 400; guard++) {
    const start = zonedToUtc(y, m, d, startHour, 0, timeZone)
    const end = zonedToUtc(y, m, d, endHour, 0, timeZone)
    if (start >= to) break
    if (end > from) out.push({ start: Math.max(start, from), end: Math.min(end, to) })
    const next = new Date(Date.UTC(y, m - 1, d + 1))
    y = next.getUTCFullYear(); m = next.getUTCMonth() + 1; d = next.getUTCDate()
  }
  return out
}

// Free windows of at least `durationMs`, inside working hours, across the busy times given.
export function findFreeSlots(args: {
  busy: Interval[]; from: number; to: number; timeZone: string;
  durationMs: number; startHour: number; endHour: number; limit?: number;
}): Interval[] {
  const { busy, from, to, timeZone, durationMs, startHour, endHour, limit = 20 } = args
  const slots: Interval[] = []
  for (const w of workWindows(from, to, timeZone, startHour, endHour)) {
    for (const f of subtractBusy(w, busy)) {
      if (f.end - f.start >= durationMs) slots.push(f)
      if (slots.length >= limit) return slots
    }
  }
  return slots
}
