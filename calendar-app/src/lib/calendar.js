// Pure date helpers for the calendar views. All dates are local time.

const pad = (n) => String(n).padStart(2, '0')

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// 'YYYY-MM-DD' in local time: the key used to group events by day.
export function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

// Adds months and keeps the day of month when the target month is long enough
// (31 Jan + 1 month = 28/29 Feb, not 3 March).
export function addMonths(d, n) {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  first.setDate(Math.min(d.getDate(), last))
  return first
}

// Monday of the week containing d (weeks start on Monday, as in the UI).
export function startOfWeek(d) {
  const offset = (d.getDay() + 6) % 7
  return addDays(startOfDay(d), -offset)
}

export function weekDays(d) {
  const start = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

// Always 6 full weeks, so the grid height does not change between months.
export function monthGrid(d) {
  const start = startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function isSameDay(a, b) {
  return dateKey(a) === dateKey(b)
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export function formatMonth(d, locale) {
  return cap(new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d))
}

export function formatDay(d, locale) {
  return cap(new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(d))
}

export function formatWeekRange(d, locale) {
  const days = weekDays(d)
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
  return `${fmt.format(days[0])} – ${fmt.format(days[6])}`
}

export function formatTime(d, locale) {
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}
