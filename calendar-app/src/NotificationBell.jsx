import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { listNotifications, markAllNotificationsRead, markNotificationRead, subscribeNotifications, getNamesByIds } from './lib/api.js'

// Bell with an unread count. A new mention rings the bell and shows a short notice.
// Opening an item marks it read and opens the chat of that calendar.
export default function NotificationBell({ userId, onOpen }) {
  const { t, locale } = useI18n()
  const [items, setItems] = useState([])
  const [names, setNames] = useState({})
  const [open, setOpen] = useState(false)
  const [ringKey, setRingKey] = useState(0)
  const [toast, setToast] = useState(null)
  const unread = items.filter((n) => !n.read_at).length

  useEffect(() => {
    listNotifications().then(setItems).catch(() => {})
  }, [userId])

  useEffect(() => subscribeNotifications(userId, (n) => {
    setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 30))
    setRingKey((k) => k + 1)
    setToast(n)
  }), [userId])

  useEffect(() => {
    const missing = [...new Set(items.map((n) => n.actor_id).filter(Boolean))].filter((id) => !names[id])
    if (!missing.length) return
    getNamesByIds(missing)
      .then((rows) => setNames((p) => ({ ...p, ...Object.fromEntries(rows.map((r) => [r.id, r.handle ? `@${r.handle}` : (r.display_name || r.email)])) })))
      .catch(() => {})
  }, [items, names])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(id)
  }, [toast])

  const who = (n) => names[n.actor_id] || '@'

  async function openItem(n) {
    setOpen(false)
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: x.read_at || new Date().toISOString() } : x)))
    if (!n.read_at) markNotificationRead(n.id).catch(() => {})
    onOpen(n.calendar_id)
  }

  async function markAll() {
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })))
    } catch { /* keep the list as it is */ }
  }

  const when = (iso) => new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })

  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); setToast(null) }} aria-expanded={open}
        aria-label={`${t('notifications')}${unread ? ` (${unread})` : ''}`}
        className="relative p-1.5 text-neutral-700 hover:text-neutral-900">
        <svg key={ringKey} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
          className={`h-6 w-6 ${ringKey ? 'bell-ring' : ''}`} aria-hidden="true">
          <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-neutral-900 text-white text-[10px] leading-[1.15rem] text-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {toast && !open && (
        <button type="button" onClick={() => openItem(toast)} role="status"
          className="absolute end-0 top-full mt-2 w-64 rounded-2xl bg-neutral-900 text-white text-xs text-start px-4 py-3 shadow-xl z-30">
          {who(toast)} {t('mentionedYou')}
        </button>
      )}

      {open && (
        <div className="absolute end-0 top-full mt-2 w-72 max-h-80 overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 p-2 z-30">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <span className="text-sm font-medium text-neutral-900">{t('notifications')}</span>
            {unread > 0 && <button type="button" onClick={markAll} className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2">{t('markAllRead')}</button>}
          </div>
          {items.length === 0 && <p className="px-2 py-3 text-sm text-neutral-500">{t('noNotifications')}</p>}
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openItem(n)}
                  className={`w-full text-start rounded-xl px-3 py-2 text-sm hover:bg-neutral-50 ${n.read_at ? 'text-neutral-500' : 'text-neutral-900 font-medium'}`}>
                  <span className="block">{who(n)} {t('mentionedYou')}</span>
                  <span className="block text-xs text-neutral-400">{when(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
