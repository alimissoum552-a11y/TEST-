import { useEffect, useState } from 'react'
import { useI18n, LanguageSelect } from './i18n/index.jsx'
import SharePanel from './SharePanel.jsx'
import TeamPanel from './TeamPanel.jsx'
import { supabase } from './lib/supabase.js'
import { getDefaultCalendar, listEvents, createEvent, updateEvent, deleteEvent, subscribeToEvents, listHistory, restoreVersion } from './lib/api.js'

// Maps a DB row to the shape the UI uses (date = day-of-month, time = "HH:MM – HH:MM").

const ICON_PATHS = {
  month: <><rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M3 9.5h18M8 3v3M16 3v3" /></>,
  week: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 3v18" strokeOpacity=".4" /></>,
  day: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  events: <><path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M8 9h8M8 13h5" /></>,
  add: <path d="M12 5v14M5 12h14" />,
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
  title: r.title,
  description: r.description,
  location: r.location,
  starts_at: r.starts_at,
  ends_at: r.ends_at,
  date: new Date(r.starts_at).getDate(),
  time: `${hhmm(r.starts_at, locale)} – ${hhmm(r.ends_at, locale)}`,
  tone: r.color_tone || 'bg-neutral-600',
  reminder_minutes: r.reminder_minutes,
})
const toneClass = (t) => (t && t.startsWith('bg-') ? t : 'bg-neutral-600')

const TABS = ['month', 'week', 'day', 'events']


const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i)

// September 2026: 1st is a Tuesday (Monday-first grid)
function monthCells() {
  const cells = [null]
  for (let d = 1; d <= 30; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return cells
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
        <p className="text-sm text-neutral-600">{event.date} {t('monthName').toLowerCase()} · {event.time}</p>
        <p className="text-xs text-neutral-400">{t('repeat')} : {t('none')} · {t('reminder')} : {t('minBefore')}</p>
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

function MonthView({ events, selected, setSelected, onOpen }) {
  const { t, locale } = useI18n()
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <section>
        <div className="grid grid-cols-7 text-center text-xs text-neutral-400 mb-2">
          {t('weekDays').map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-2 text-center">
          {monthCells().map((d, i) => {
            const has = d && events.some((e) => e.date === d)
            const isSel = d === selected
            return (
              <button
                key={i}
                disabled={!d}
                onClick={() => d && setSelected(d)}
                className={`relative mx-auto h-9 w-9 md:h-11 md:w-11 rounded-full text-sm md:text-base transition ${
                  isSel ? 'bg-neutral-900 text-white' : 'text-neutral-800 hover:bg-neutral-100'
                } ${!d ? 'invisible' : ''}`}
              >
                {d}
                {has && !isSel && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-neutral-500" />
                )}
              </button>
            )
          })}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-700">{t('upcoming')}</h2>
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id}>
              <button onClick={() => onOpen(e)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-left">
                <span className={`h-8 w-1 rounded-full ${toneClass(e.tone)}`} />
                <span className="flex-1">
                  <span className="block text-sm text-neutral-900">{e.title}</span>
                  <span className="block text-xs text-neutral-500">{e.date} {t('sep')} · {e.time}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Timeline({ dayEvents, onOpen }) {
  const { locale } = useI18n()
  return (
    <ol>
      {HOURS.map((h) => {
        const evs = dayEvents.filter((e) => parseInt(e.time.slice(0, 2)) === h)
        return (
          <li key={h} className="flex gap-3 min-h-[56px] border-t border-neutral-100">
            <span className="w-12 pt-1 text-xs text-neutral-400">{String(h).padStart(2, '0')}:00</span>
            <div className="flex-1 space-y-1 py-1">
              {evs.map((e) => (
                <button key={e.id} onClick={() => onOpen(e)} className={`w-full text-left rounded-lg px-3 py-1.5 text-xs md:text-sm text-white ${toneClass(e.tone)}`}>
                  {e.title} · {e.time}
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
  const pad = (n) => String(n).padStart(2, '0')
  const today = new Date()
  const base = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(day || today.getDate())}`
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(`${base}T09:00`)
  const [end, setEnd] = useState(`${base}T10:00`)
  const [location, setLocation] = useState('')
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
        color_tone: 'bg-neutral-600', reminder_minutes: 10,
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
      {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-xl bg-neutral-100 text-sm">{t('cancel')}</button>
        <button disabled={busy} className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('add')}</button>
      </div>
    </form>
  )
}

export default function App({ user }) {
  const { t, locale, lang } = useI18n()
  const [tab, setTab] = useState('month')
  const [selected, setSelected] = useState(new Date().getDate())
  const [openEvent, setOpenEvent] = useState(null)
  const [adding, setAdding] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [team, setTeam] = useState(false)
  const [calendar, setCalendar] = useState(null)
  const [events, setEvents] = useState([])
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const cal = await getDefaultCalendar(user.id)
        const rows = await listEvents(cal.id)
        if (!cancelled) { setCalendar(cal); setEvents(rows.map((r) => toUI(r, locale))) }
      } catch (ex) { if (!cancelled) setLoadError(ex.message) }
    })()
    return () => { cancelled = true }
  }, [user, locale])

  const dayEvents = events.filter((e) => e.date === selected)

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
    if (!calendar) return
    return subscribeToEvents(calendar.id, (payload) => {
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
    })
  }, [calendar, locale])

  async function signOut() { await supabase.auth.signOut() }

  return (
    <div className="min-h-screen bg-neutral-200 flex items-stretch md:items-center justify-center md:p-6">
      <div className="relative w-full md:max-w-3xl lg:max-w-5xl md:h-[min(90vh,820px)] min-h-screen md:min-h-0 bg-white md:rounded-[32px] md:shadow-xl overflow-hidden flex flex-col">
        <header className="px-4 md:px-10 pt-5 md:pt-8 pb-2 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-neutral-500">{t('monthName')} {t('year')}</p>
              <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 truncate">
                {tab === 'day' ? `${selected} ${t('monthName').toLowerCase()}` : t('calendar')}
              </h1>
            </div>
            <div className="flex items-center gap-1">
              {user && <Action icon="add" label={t('newEvent')} onClick={() => setAdding(true)} />}
              {user && calendar && <Action icon="team" label={t('team')} active={team} onClick={() => setTeam(true)} />}
              {user && calendar && <Action icon="share" label={t('sharing')} onClick={() => setSharing(true)} />}
              {user && <Action icon="logout" label={t('signOut')} onClick={signOut} />}
              <div className="relative">
                <Action icon="language" label={lang.toUpperCase()} ariaLabel={t('language')} active={langOpen} onClick={() => setLangOpen((o) => !o)} />
                {langOpen && <LanguageSelect onPick={() => setLangOpen(false)} />}
              </div>
            </div>
          </div>
          <ActionBar>
            {TABS.map((k) => (
              <Action key={k} icon={k} label={t(k)} active={tab === k} onClick={() => setTab(k)} />
            ))}
          </ActionBar>
        </header>


        {loadError && <p className="px-5 md:px-10 pt-3 text-sm font-medium text-neutral-900">{loadError}</p>}

        <main className="flex-1 overflow-y-auto px-5 md:px-10 py-4 md:py-6">
          {tab === 'month' && <MonthView events={events} selected={selected} setSelected={setSelected} onOpen={setOpenEvent} />}
          {(tab === 'day' || tab === 'week') && (
            <div className={tab === 'week' ? 'md:grid md:grid-cols-2 md:gap-6' : ''}>
              <Timeline dayEvents={dayEvents} onOpen={setOpenEvent} />
              {tab === 'week' && <Timeline dayEvents={events.filter((e) => e.date === selected + 1)} onOpen={setOpenEvent} />}
            </div>
          )}
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
              <NewEventForm calendarId={calendar?.id} userId={user?.id} day={selected}
                onCreated={(row) => { setEvents((l) => [...l, toUI(row, locale)].sort((a, b) => a.starts_at.localeCompare(b.starts_at))); setAdding(false) }}
                onCancel={() => setAdding(false)} />
            </div>
          </div>
        )}

        {team && calendar && <TeamPanel calendarId={calendar.id} ownerId={calendar.owner_id} onClose={() => setTeam(false)} />}
        {sharing && calendar && <SharePanel calendarId={calendar.id} currentUserId={user.id} onClose={() => setSharing(false)} />}
        {openEvent && <EventDetail event={openEvent} onClose={() => setOpenEvent(null)} onDelete={handleDelete} onSave={handleSave} />}
      </div>
    </div>
  )
}
