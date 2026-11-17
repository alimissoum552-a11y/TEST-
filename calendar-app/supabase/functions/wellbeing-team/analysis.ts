// Pure rules of the team well-being analysis. No I/O here, so they can be tested without a database or a model.

export type Ev = { starts_at: string; ends_at: string; all_day?: boolean | null }

export const DEFAULT_THRESHOLD_HOURS = 3
export const MIN_MESSAGES_TO_REVIEW = 3

// Meeting hours per UTC day. An event that crosses midnight is split between the days it touches.
export function hoursByDay(events: Ev[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const e of events) {
    if (e.all_day) continue
    const start = Date.parse(e.starts_at)
    const end = Date.parse(e.ends_at)
    if (!(end > start)) continue
    let cur = start
    while (cur < end) {
      const d = new Date(cur)
      const nextDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
      const segEnd = Math.min(end, nextDay)
      const key = d.toISOString().slice(0, 10)
      totals.set(key, (totals.get(key) ?? 0) + (segEnd - cur) / 3600_000)
      cur = segEnd
    }
  }
  return totals
}

// Days where the calendar's meeting load is strictly above the threshold (in hours).
export function overloadedDays(events: Ev[], thresholdHours: number): { day: string; hours: number }[] {
  return [...hoursByDay(events)]
    .filter(([, h]) => h > thresholdHours)
    .map(([day, h]) => ({ day, hours: Math.round(h * 10) / 10 }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

export function clampThreshold(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(12, Math.max(1, n)) : DEFAULT_THRESHOLD_HOURS
}

export type Signal = { index: number; kind: 'crisis' }
export type Review = { signals: Signal[]; tension: boolean; overload: boolean }

// Reads the model's answer. Anything malformed is dropped, so a bad answer never creates an alert.
// index is 1-based and refers to the numbered messages sent to the model.
export function parseReview(text: string, count: number): Review | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  let o: any
  try { o = JSON.parse(match[0]) } catch { return null }
  const signals: Signal[] = []
  if (Array.isArray(o?.signals)) {
    for (const s of o.signals) {
      if (s?.kind === 'crisis' && Number.isInteger(s.index) && s.index >= 1 && s.index <= count) {
        signals.push({ index: s.index, kind: 'crisis' })
      }
    }
  }
  return { signals, tension: o?.tension === true, overload: o?.overload === true }
}
