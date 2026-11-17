import { useEffect, useState } from 'react'
import { useI18n, LanguageSelect } from './i18n/index.jsx'
import SharePanel from './SharePanel.jsx'
import TeamPanel from './TeamPanel.jsx'
import ProfilePanel from './ProfilePanel.jsx'
import LockPanel from './LockPanel.jsx'
import InvitesPanel from './InvitesPanel.jsx'
import AssistantPanel from './AssistantPanel.jsx'
import ChatPanel from './ChatPanel.jsx'
import ConnectorGuide from './ConnectorGuide.jsx'
import NotificationBell from './NotificationBell.jsx'
import Avatar from './Avatar.jsx'
import { getMyProfile } from './lib/api.js'
import { supabase } from './lib/supabase.js'
import { getDefaultCalendar, listAccessibleCalendars, listEventsForCalendars, createEvent, updateEvent, deleteEvent, subscribeToEvents, listHistory, restoreVersion } from './lib/api.js'
import { dateKey, addDays, addMonths, weekDays, monthGrid, isSameMonth, isSameDay, startOfDay, formatMonth, formatDay, formatWeekRange, formatTime } from './lib/calendar.js'

// Maps a DB row to the shape the UI uses (dateKey = 'YYYY-MM-DD' local, time = "HH:MM – HH:MM").

const ICON_PATHS = {
  month: <><rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M3 9.5h18M8 3v3M16 3v3" /></>,
  week: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 3v18" strokeOpacity=".4" /></>,
  day: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  events: <><path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M8 9h8M8 13h5" /></>,
  add: <path d="M12 5v14M5 12h14" />,
  plug: <><path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0z" /><path d="M12 16v5" /></>,
  chat: <><path d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5V16.5H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" /></>,
  ai: <><path d="M9.5 4.5c.4 3 2.1 4.8 5.1 5.2-3 .4-4.7 2.2-5.1 5.2-.4-3-2.1-4.8-5.1-5.2 3-.4 4.7-2.2 5.1-5.2z" /><path d="M18 3.5c.2 1.4.9 2.1 2.3 2.3-1.4.2-2.1.9-2.3 2.3-.2-1.4-.9-2.1-2.3-2.3 1.4-.2 2.1-.9 2.3-2.3z" /><path d="M17.5 14.5c.15 1 .6 1.45 1.6 1.6-1 .15-1.45.6-1.6 1.6-.15-1-.6-1.45-1.6-1.6 1-.15 1.45-.6 1.6-1.6z" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  lockOpen: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 7.5-2" /></>,
  guide: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" /></>,
  profile: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  team: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c.8-3 3-4.8 5.5-4.8s4.7 1.8 5.5 4.8" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.3c2.4.2 4.2 1.7 4.9 4.2" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  language: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" /></>,
}
function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  )
}

// Flexible icon bar: horizontal scroll if space runs out, no frames.
// Mobile: icon only. Tablet and desktop: icon + label.
function ActionBar({ children }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-nowrap min-w-0">
      {children}
    </div>
  )
}
function Action({ icon, label, onClick, active = false, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label}
      aria-pressed={active || undefined}
      className={`shrink-0 inline-flex items-center gap-2 px-2 py-1.5 md:px-3 text-sm transition-colors ${
        active ? 'text-neutral-900 font-semibold' : 'text-neutral-400 hover:text-neutral-800'
      }`}
    >
      <Icon name={icon} />
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}

const hhmm = (d, locale) => new Date(d).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
const toUI = (r, locale) => ({
  id: r.id,
  calendar_id: r.calendar_id,
  owner_id: r.owner_id,
  title: r.title,
  description: r.description,
  location: r.location,
  starts_at: r.starts_at,
  ends_at: r.ends_at,
  dateKey: dateKey(new Date(r.starts_at)),
  time: `${hhmm(r.starts_at, locale)} – ${hhmm(r.ends_at, locale)}`,
  tone: r.color_tone || 'bg-neutral-600',
  reminder_minutes: r.reminder_minutes,
})
const toneClass = (t) => (t && t.startsWith('bg-') ? t : 'bg-neutral-600')

const TABS = ['month', 'week', 'day', 'events']


const HOURS = Array.from({ length: 24 }, (_, i) => i)

// Events grouped by 'YYYY-MM-DD', each day sorted by start time.
function groupByDay(events) {
  const map = new Map()
  for (const e of events) {
    if (!map.has(e.dateKey)) map.set(e.dateKey, [])
    map.get(e.dateKey).push(e)
  }
  return map
}

function ActivityList({ eventId, onRestored }) {
  const { t, locale } = useI18n()
  const [items, setItems] = useState(null)
  const [msg, setMsg] = useState(null)
  const load = () => listHistory(eventId).then(setItems).catch((ex) => setMsg(ex.message))
  useEffect(() => { load() }, [eventId])

  async function restore(h) {
    try {
      const row = await restoreVersion(h.id)
      setMsg(t('restored')); onRestored(row); load()
    } catch (ex) { setMsg(ex.message) }
  }

  const verb = { insert: t('created'), update: t('updated'), delete: t('deleted') }
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('activity')}</h4>
      {msg && <p className="text-xs text-neutral-700">{msg}</p>}
      {items && items.length === 0 && <p className="text-xs text-neutral-400">{t('noHistory')}</p>}
      <ul className="space-y-2 max-h-40 overflow-y-auto">
        {(items || []).map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2 text-xs text-neutral-600">
            <span className="min-w-0 truncate">
              {verb[h.action]} · {new Date(h.created_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
            </span>
            {h.action !== 'delete' && (
              <button onClick={() => restore(h)} className="shrink-0 text-neutral-900 underline underline-offset-2">{t('restore')}</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function EventDetail({ event, onClose, onDelete, onSave }) {
  const { t, locale } = useI18n()
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
        <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">{t('edit')}</h3>
          <EventEditForm event={event} onSaved={(row) => { onSave(row); setEditing(false) }} onCancel={() => setEditing(false)} />
        </div>
      </div>
    )
  }
  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 space-y-4 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${toneClass(event.tone)}`} />
          <h3 className="text-lg md:text-xl font-semibold text-neutral-900">{event.title}</h3>
        </div>
        <p className="text-sm text-neutral-600">{formatDay(new Date(event.starts_at), locale)} · {event.time}</p>
        <p className="text-xs text-neutral-400">{t('repeat')} : {t('none')} · {t('reminder')} : {event.reminder_minutes ?? 0} min</p>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="flex-1 py-2 rounded-xl bg-neutral-100 text-neutral-900 text-sm hover:bg-neutral-200">{t('edit')}</button>
          <button onClick={() => onDelete(event)} className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm hover:bg-neutral-700">{t('delete')}</button>
        </div>
        <ActivityList eventId={event.id} onRestored={(row) => onSave(row)} />
        <button onClick={onClose} className="w-full text-sm text-neutral-500 hover:text-neutral-800">{t('close')}</button>
      </div>
    </div>
  )
}

// Prev / next / today bar shared by the month, week and day views.
// The period is already in the page title, so the bar only holds the controls.
function Navigator({ onPrev, onNext, onToday }) {
  const { t } = useI18n()
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
  const btn = 'h-9 w-9 rounded-full text-neutral-700 hover:bg-neutral-100 text-lg leading-none'
  return (
    <div className="flex items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={onPrev} aria-label={t('prev')} className={btn}>{rtl ? '›' : '‹'}</button>
        <button type="button" onClick={onNext} aria-label={t('next')} className={btn}>{rtl ? '‹' : '›'}</button>
      </div>
      <button type="button" onClick={onToday} className="shrink-0 px-3 py-1.5 rounded-full text-sm bg-neutral-100 hover:bg-neutral-200 text-neutral-900">{t('today')}</button>
    </div>
  )
}

function EventRow({ event, onOpen, calendarName }) {
  const { locale } = useI18n()
  const cal = calendarName(event.calendar_id)
  return (
    <button onClick={() => onOpen(event)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-left">
      <span className={`h-8 w-1 rounded-full ${toneClass(event.tone)}`} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-neutral-900 truncate">{event.title}</span>
        <span className="block text-xs text-neutral-500">
          {formatTime(new Date(event.starts_at), locale)} – {formatTime(new Date(event.ends_at), locale)}
          {cal && <> · <em className="not-italic text-neutral-400">{cal}</em></>}
        </span>
      </span>
    </button>
  )
}

function MonthView({ events, selected, onSelect, onOpen, calendarName }) {
  const { t, locale } = useI18n()
  const byDay = groupByDay(events)
  const grid = monthGrid(selected)
  const today = startOfDay(new Date())
  const dayList = byDay.get(dateKey(selected)) || []
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <section>
        <div className="grid grid-cols-7 text-center text-xs text-neutral-400 mb-2">
          {t('weekDays').map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-2 text-center">
          {grid.map((d) => {
            const inMonth = isSameMonth(d, selected)
            const isSel = isSameDay(d, selected)
            const isToday = isSameDay(d, today)
            const has = (byDay.get(dateKey(d)) || []).length > 0
            return (
              <button
                key={dateKey(d)}
                type="button"
                onClick={() => onSelect(startOfDay(d))}
                aria-label={formatDay(d, locale)}
                aria-pressed={isSel}
                aria-current={isToday ? 'date' : undefined}
                className={`relative mx-auto h-9 w-9 md:h-11 md:w-11 rounded-full text-sm md:text-base transition ${
                  isSel ? 'bg-neutral-900 text-white'
                    : isToday ? 'ring-1 ring-inset ring-neutral-900 text-neutral-900'
                    : inMonth ? 'text-neutral-800 hover:bg-neutral-100'
                    : 'text-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {d.getDate()}
                {has && !isSel && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-neutral-500" />
                )}
              </button>
            )
          })}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-700">{formatDay(selected, locale)}</h2>
        {dayList.length === 0 && <p className="text-sm text-neutral-400">{t('noEventsDay')}</p>}
        <ul className="space-y-2">
          {dayList.map((e) => (
            <li key={e.id}><EventRow event={e} onOpen={onOpen} calendarName={calendarName} /></li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// Seven days, Monday to Sunday, each with its events in order.
function WeekList({ events, selected, onOpen, calendarName }) {
  const { locale } = useI18n()
  const byDay = groupByDay(events)
  const today = startOfDay(new Date())
  return (
    <div className="grid gap-5 md:grid-cols-2 md:gap-6">
      {weekDays(selected).map((d) => {
        const list = byDay.get(dateKey(d)) || []
        return (
          <section key={dateKey(d)} className={isSameDay(d, today) ? 'rounded-2xl ring-1 ring-inset ring-neutral-900 p-3' : ''}>
            <h2 className={`mb-2 text-sm font-medium ${isSameDay(d, selected) ? 'text-neutral-900' : 'text-neutral-700'}`}>{formatDay(d, locale)}</h2>
            {list.length > 0 && (
              <ul className="space-y-2">
                {list.map((e) => <li key={e.id}><EventRow event={e} onOpen={onOpen} calendarName={calendarName} /></li>)}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

// One day, 24 hourly rows. Events sit in the row of their start hour.
function Timeline({ dayEvents, onOpen }) {
  const { locale } = useI18n()
  return (
    <ol>
      {HOURS.map((h) => {
        const evs = dayEvents.filter((e) => new Date(e.starts_at).getHours() === h)
        return (
          <li key={h} className="flex gap-3 min-h-[56px] border-t border-neutral-100">
            <span className="w-12 pt-1 text-xs text-neutral-400">{String(h).padStart(2, '0')}:00</span>
            <div className="flex-1 space-y-1 py-1">
              {evs.map((e) => (
                <button key={e.id} onClick={() => onOpen(e)} className={`w-full text-left rounded-lg px-3 py-1.5 text-xs md:text-sm text-white ${toneClass(e.tone)}`}>
                  {e.title} · {formatTime(new Date(e.starts_at), locale)}
                </button>
              ))}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function EventEditForm({ event, onSaved, onCancel }) {
  const { t } = useI18n()
  const toLocal = (iso) => {
    const d = new Date(iso); const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }
  const [title, setTitle] = useState(event.title || '')
  const [location, setLocation] = useState(event.location || '')
  const [description, setDescription] = useState(event.description || '')
  const [start, setStart] = useState(toLocal(event.starts_at))
  const [end, setEnd] = useState(toLocal(event.ends_at))
  const [reminder, setReminder] = useState(event.reminder_minutes ?? 10)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const input = 'w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900'

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      const row = await updateEvent(event.id, {
        title, location: location || null, description: description || null,
        starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(),
        reminder_minutes: Number(reminder),
      })
      onSaved(row)
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input className={input} required placeholder={t('title')} value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={input} placeholder={t('location')} value={location} onChange={(e) => setLocation(e.target.value)} />
      <textarea className={input} rows={3} placeholder={t('description')} value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input className={input} type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
        <input className={input} type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <label className="flex items-center justify-between text-sm text-neutral-700">
        {t('reminder')}
        <select className={input + ' w-auto'} value={reminder} onChange={(e) => setReminder(e.target.value)}>
          {[0, 5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
      </label>
      {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-xl bg-neutral-100 text-sm">{t('cancel')}</button>
        <button disabled={busy} className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('save')}</button>
      </div>
    </form>
  )
}

function NewEventForm({ calendarId, userId, day, onCreated, onCancel }) {
  const { t } = useI18n()
  const base = dateKey(day || new Date())
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(`${base}T09:00`)
  const [end, setEnd] = useState(`${base}T10:00`)
  const [location, setLocation] = useState('')
  const [reminder, setReminder] = useState(10)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const input = 'w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900'

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      const row = await createEvent({
        calendar_id: calendarId, owner_id: userId, title,
        location: location || null,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
        color_tone: 'bg-neutral-600', reminder_minutes: Number(reminder),
      })
      onCreated(row)
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input className={input} required placeholder={t('title')} value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={input} placeholder={t('location')} value={location} onChange={(e) => setLocation(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input className={input} type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
        <input className={input} type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <label className="flex items-center justify-between text-sm text-neutral-700">
        {t('reminder')}
        <select className={input + ' w-auto'} value={reminder} onChange={(e) => setReminder(e.target.value)}>
          {[0, 5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
      </label>
      {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-xl bg-neutral-100 text-sm">{t('cancel')}</button>
        <button disabled={busy} className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('add')}</button>
      </div>
    </form>
  )
}

export default function App({ user, initialCalendarId = null, lockOn = false, onLockChanged, onLockNow }) {
  const { t, locale, lang } = useI18n()
  const [tab, setTab] = useState('month')
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const [openEvent, setOpenEvent] = useState(null)
  const [adding, setAdding] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [team, setTeam] = useState(false)
  const [assistant, setAssistant] = useState(false)
  const [chat, setChat] = useState(false)
  const [connector, setConnector] = useState(false)
  const [me, setMe] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [lockOpen, setLockOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [calendar, setCalendar] = useState(null)
  const [events, setEvents] = useState([])
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (!user) return
    getMyProfile(user.id).then(setMe).catch(() => {})
  }, [user])

  const [calendars, setCalendars] = useState([])
  const [activeId, setActiveId] = useState(initialCalendarId)

  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const [def, all] = await Promise.all([getDefaultCalendar(user.id), listAccessibleCalendars(user.id)])
        const rows = await listEventsForCalendars(all.map((c) => c.id))
        if (!cancelled) {
          setCalendar(def)
          setCalendars(all)
          setActiveId((prev) => prev || def?.id || all[0]?.id || null)
          setEvents(rows.map((r) => toUI(r, locale)))
        }
      } catch (ex) { if (!cancelled) setLoadError(ex.message) }
    })()
    return () => { cancelled = true }
  }, [user, locale, reloadKey])

  const activeCalendar = calendars.find((c) => c.id === activeId) || calendar || calendars[0] || null
  const canWrite = activeCalendar ? activeCalendar.my_role !== 'reader' : false

  const dayEvents = events.filter((e) => e.dateKey === dateKey(selected))
  // Moves the selection by one month, week or day, depending on the active view.
  const step = (dir) => setSelected((d) => (
    tab === 'month' ? addMonths(d, dir) : addDays(d, tab === 'week' ? 7 * dir : dir)
  ))
  const navLabel = tab === 'month' ? formatMonth(selected, locale)
    : tab === 'week' ? formatWeekRange(selected, locale)
    : formatDay(selected, locale)
  const calendarNameOf = (id) => {
    const c = calendars.find((x) => x.id === id)
    if (!c || c.my_role === 'owner') return null
    return c.name || c.owner_id
  }

  async function handleDelete(ev) {
    try {
      await deleteEvent(ev.id)
      setEvents((list) => list.filter((x) => x.id !== ev.id))
      setOpenEvent(null)
    } catch (ex) { setLoadError(ex.message) }
  }

  function handleSave(row) {
    const ui = toUI(row, locale)
    setEvents((l) => l.map((x) => (x.id === row.id ? ui : x)).sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
    setOpenEvent(ui)
  }

  useEffect(() => {
    if (!calendars.length) return
    const unsubs = calendars.map((c) => subscribeToEvents(c.id, (payload) => {
      const { eventType, new: row, old } = payload
      if (eventType === 'DELETE') {
        setEvents((l) => l.filter((x) => x.id !== old.id))
      } else {
        const ui = toUI(row, locale)
        setEvents((l) => {
          const exists = l.some((x) => x.id === row.id)
          const next = exists ? l.map((x) => (x.id === row.id ? ui : x)) : [...l, ui]
          return next.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        })
      }
    }))
    return () => unsubs.forEach((u) => u())
  }, [calendars, locale])

  async function signOut() { await supabase.auth.signOut() }

  // A notification opens the chat of its calendar.
  const openChatFor = (calendarId) => { setActiveId(calendarId); setChat(true) }

  return (
    <div className="min-h-screen bg-neutral-200 flex items-stretch md:items-center justify-center md:p-6">
      <div className="relative w-full md:max-w-3xl lg:max-w-5xl md:h-[min(90vh,820px)] min-h-screen md:min-h-0 bg-white md:rounded-[32px] md:shadow-xl overflow-hidden flex flex-col">
        <header className="px-4 md:px-10 pt-5 md:pt-8 pb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs md:text-sm text-neutral-500 truncate">{t('calendar')}{activeCalendar && activeCalendar.my_role !== 'owner' ? ` · ${activeCalendar.name}${activeCalendar.owner_name ? ` (${activeCalendar.owner_name})` : ''}` : ''}</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 truncate">
              {tab === 'events' ? t('events') : navLabel}
            </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {user && <NotificationBell userId={user.id} onOpen={openChatFor} />}
            {user && (
              <button type="button" onClick={() => setProfileOpen(true)} aria-label={t('profile')} className="rounded-full p-0.5 hover:opacity-80">
                <Avatar name={me?.display_name} email={me?.email || user.email} url={me?.avatar_url} />
              </button>
            )}
            <button type="button" onClick={() => setMenuOpen(true)} aria-label={t('menu')}
              className="p-1.5 text-neutral-700 hover:text-neutral-900">
              <Icon name="menu" className="h-6 w-6" />
            </button>
          </div>
        </header>


        {loadError && <p className="px-5 md:px-10 pt-3 text-sm font-medium text-neutral-900">{loadError}</p>}

        <main className="flex-1 overflow-y-auto px-5 md:px-10 py-4 md:py-6">
          {tab !== 'events' && (
            <Navigator onPrev={() => step(-1)} onNext={() => step(1)} onToday={() => setSelected(startOfDay(new Date()))} />
          )}
          {tab === 'month' && <MonthView events={events} selected={selected} onSelect={setSelected} onOpen={setOpenEvent} calendarName={calendarNameOf} />}
          {tab === 'week' && <WeekList events={events} selected={selected} onOpen={setOpenEvent} calendarName={calendarNameOf} />}
          {tab === 'day' && <Timeline dayEvents={dayEvents} onOpen={setOpenEvent} />}
          {tab === 'events' && (
            <ul className="grid gap-2 md:grid-cols-2 md:gap-3">
              {events.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setOpenEvent(e)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-left">
                    <span className={`h-3 w-3 rounded-full ${toneClass(e.tone)}`} />
                    <span className="text-sm text-neutral-900">{e.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </main>

        {adding && (
          <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setAdding(false)}>
            <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">{t('newEventTitle')}</h3>
              <NewEventForm calendarId={activeCalendar?.id} userId={user?.id} day={selected}
                onCreated={(row) => { setEvents((l) => [...l, toUI(row, locale)].sort((a, b) => a.starts_at.localeCompare(b.starts_at))); setAdding(false) }}
                onCancel={() => setAdding(false)} />
            </div>
          </div>
        )}

        {menuOpen && (
          <div className="absolute inset-0 z-20 flex justify-end bg-black/40" onClick={() => setMenuOpen(false)}>
            <aside className="h-full w-full sm:w-80 bg-white shadow-xl p-6 flex flex-col gap-6 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">{t('menu')}</h2>
                <button type="button" onClick={() => setMenuOpen(false)} aria-label={t('close')} className="p-1 text-neutral-700 hover:text-neutral-900">
                  <Icon name="close" className="h-6 w-6" />
                </button>
              </div>

              <section className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">{t('views')}</h3>
                {TABS.map((k) => (
                  <button key={k} onClick={() => { setTab(k); setMenuOpen(false) }} aria-pressed={tab === k}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-start ${tab === k ? 'font-semibold text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'}`}>
                    <Icon name={k} /> <span>{t(k)}</span>
                  </button>
                ))}
              </section>

              {calendars.length > 1 && (
                <section className="space-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">{t('calendars')}</h3>
                  {calendars.map((c) => (
                    <button key={c.id} onClick={() => { setActiveId(c.id); setMenuOpen(false) }}
                      aria-pressed={activeCalendar?.id === c.id}
                      className={`w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg text-sm text-start ${activeCalendar?.id === c.id ? 'font-semibold text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'}`}>
                      <span className="truncate">{c.name || c.id}{c.my_role !== 'owner' && c.owner_name ? ` · ${c.owner_name}` : ''}</span>
                      <span className="shrink-0 text-xs text-neutral-400">{t(c.my_role)}</span>
                    </button>
                  ))}
                </section>
              )}

              {user && (
                <section className="space-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">{t('actions')}</h3>
                  {canWrite && <button onClick={() => { setAdding(true); setMenuOpen(false) }} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-neutral-700 hover:text-neutral-900"><Icon name="add" /> <span>{t('newEvent')}</span></button>}
                  {activeCalendar && <button onClick={() => { setChat(true); setMenuOpen(false) }} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-neutral-700 hover:text-neutral-900"><Icon name="chat" /> <span>{t('chat')}</span></button>}
                  {user && <button onClick={() => { setConnector(true); setMenuOpen(false) }} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-neutral-700 hover:text-neutral-900"><Icon name="plug" /> <span>{t('connectorMenu')}</span></button>}
                  <button onClick={() => { setAssistant(true); setMenuOpen(false) }} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-neutral-700 hover:text-neutral-900"><Icon name="ai" /> <span>{t('assistant')}</span></button>
                  {calendar && <button onClick={() => { setTeam(true); setMenuOpen(false) }} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-neutral-700 hover:text-neutral-900"><Icon name="team" /> <span>{t('team')}</span></button>}
                  {calendar && <button onClick={() => { setSharing(true); setMenuOpen(false) }} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-neutral-700 hover:text-neutral-900"><Icon name="share" /> <span>{t('sharing')}</span></button>}
                  <button onClick={() => { setMenuOpen(false); window.location.hash = '/ai-guide' }} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-neutral-700 hover:text-neutral-900"><Icon name="guide" /> <span>{t('aiGuide')}</span></button>
                  <button onClick={() => setLockOpen((o) => !o)} aria-expanded={lockOpen} aria-label={t('lockMenuTitle')}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm ${lockOpen ? 'text-neutral-900 font-medium' : 'text-neutral-700 hover:text-neutral-900'}`}>
                    <Icon name={lockOn ? 'lock' : 'lockOpen'} /> <span>{t('lockMenuTitle')}</span>
                  </button>
                  {lockOpen && (
                    <LockPanel inline enabled={lockOn} user={user} onClose={() => setLockOpen(false)}
                      onChanged={(v) => { onLockChanged?.(v); setLockOpen(false) }}
                      onLockNow={() => { setLockOpen(false); onLockNow?.() }} />
                  )}
                  <button onClick={() => { setProfileOpen(true); setMenuOpen(false) }} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-neutral-700 hover:text-neutral-900"><Icon name="profile" /> <span>{t('profile')}</span></button>
                  <button onClick={signOut} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-neutral-700 hover:text-neutral-900"><Icon name="logout" /> <span>{t('signOut')}</span></button>
                </section>
              )}

              <section className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">{t('language')}</h3>
                <div className="relative">
                  <button onClick={() => setLangOpen((o) => !o)} aria-expanded={langOpen}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-neutral-700 hover:text-neutral-900">
                    <Icon name="language" /> <span>{lang.toUpperCase()}</span>
                  </button>
                  {langOpen && <LanguageSelect onPick={() => setLangOpen(false)} placement="down" />}
                </div>
              </section>
            </aside>
          </div>
        )}

        {user && <InvitesPanel onAnswered={() => setReloadKey((k) => k + 1)} />}
        {profileOpen && user && <ProfilePanel user={user} onClose={() => setProfileOpen(false)} onChanged={(url) => setMe((m) => ({ ...(m || {}), avatar_url: url }))} onHandleChanged={(h) => setMe((m) => ({ ...(m || {}), handle: h }))} />}
        {chat && user && activeCalendar && <ChatPanel key={activeCalendar.id} calendarId={activeCalendar.id} user={user} myHandle={me?.handle} canWrite={canWrite} isOwner={activeCalendar.my_role === 'owner'} onClose={() => setChat(false)} onApplied={() => setReloadKey((k) => k + 1)} />}
        {connector && user && <ConnectorGuide onClose={() => setConnector(false)} />}
        {assistant && user && <AssistantPanel user={user} onClose={() => setAssistant(false)} onApplied={() => setReloadKey((k) => k + 1)} />}
        {team && activeCalendar && <TeamPanel calendarId={activeCalendar.id} ownerId={activeCalendar.owner_id} onClose={() => setTeam(false)} />}
        {sharing && activeCalendar && <SharePanel calendarId={activeCalendar.id} canManage={['owner','administrator'].includes(activeCalendar.my_role)} onClose={() => setSharing(false)} />}
        {openEvent && <EventDetail event={openEvent} onClose={() => setOpenEvent(null)} onDelete={handleDelete} onSave={handleSave} />}
      </div>
    </div>
  )
}
