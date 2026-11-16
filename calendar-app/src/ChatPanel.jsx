import { useEffect, useRef, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import Avatar from './Avatar.jsx'
import { supabase } from './lib/supabase.js'
import { listMessages, sendMessage, deleteMessage, getNamesByIds } from './lib/api.js'

// Team chat for one calendar: history from the database, new messages by Realtime (Postgres Changes),
// online members by Presence, and "is typing" by Broadcast. Readers can read but not write.
const TYPING_SEND_MS = 2000
const TYPING_HIDE_MS = 3000

export default function ChatPanel({ calendarId, user, canWrite, onClose }) {
  const { t, locale } = useI18n()
  const myLabel = user.user_metadata?.display_name || user.email || ''
  const [messages, setMessages] = useState([])
  const [names, setNames] = useState({})
  const [online, setOnline] = useState([])
  const [typing, setTyping] = useState({}) // user_id -> label
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const channelRef = useRef(null)
  const lastTypingSent = useRef(0)
  const typingTimers = useRef({})
  const endRef = useRef(null)

  // 1. History
  useEffect(() => {
    let cancelled = false
    listMessages(calendarId)
      .then((rows) => { if (!cancelled) setMessages(rows) })
      .catch((ex) => { if (!cancelled) setErr(ex.message) })
    return () => { cancelled = true }
  }, [calendarId])

  // 2. Names of authors not yet known
  useEffect(() => {
    const missing = [...new Set(messages.map((m) => m.user_id))].filter((id) => !names[id])
    if (!missing.length) return
    getNamesByIds(missing)
      .then((rows) => setNames((prev) => ({ ...prev, ...Object.fromEntries(rows.map((r) => [r.id, r.display_name || r.email])) })))
      .catch(() => {})
  }, [messages, names])

  // 3. Realtime: new and deleted messages, presence, typing
  useEffect(() => {
    const channel = supabase.channel(`calendar:${calendarId}:chat`, {
      config: { presence: { key: user.id }, broadcast: { self: false } },
    })
    channel
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `calendar_id=eq.${calendarId}` },
        (p) => setMessages((prev) => (prev.some((m) => m.id === p.new.id) ? prev : [...prev, p.new])))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (p) => setMessages((prev) => prev.filter((m) => m.id !== p.old.id)))
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnline(Object.entries(state).map(([id, arr]) => ({ user_id: id, label: arr[0]?.label || '' })))
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload?.user_id || payload.user_id === user.id) return
        setTyping((prev) => ({ ...prev, [payload.user_id]: payload.label || '' }))
        clearTimeout(typingTimers.current[payload.user_id])
        typingTimers.current[payload.user_id] = setTimeout(() => {
          setTyping((prev) => { const next = { ...prev }; delete next[payload.user_id]; return next })
        }, TYPING_HIDE_MS)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ label: myLabel })
      })
    channelRef.current = channel
    const timers = typingTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [calendarId, user.id, myLabel])

  // Keep the newest message in view.
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [messages.length])

  const labelOf = (id) => (id === user.id ? myLabel : names[id] || '')

  function onTyping(value) {
    setText(value)
    const now = Date.now()
    if (!canWrite || !value || now - lastTypingSent.current < TYPING_SEND_MS) return
    lastTypingSent.current = now
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id, label: myLabel } })
  }

  async function send(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content || busy || !canWrite) return
    setBusy(true); setErr(null)
    try {
      const row = await sendMessage(calendarId, user.id, content)
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
      setText('')
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  async function remove(m) {
    try {
      await deleteMessage(m.id)
      setMessages((prev) => prev.filter((x) => x.id !== m.id))
    } catch (ex) { setErr(ex.message) }
  }

  // @name is highlighted when it names the signed-in user.
  function render(content) {
    const me = myLabel.toLowerCase()
    return content.split(/(@[^\s@]{1,60})/g).map((part, i) => (
      part.startsWith('@') && me && part.slice(1).toLowerCase() === me
        ? <strong key={i} className="font-semibold underline underline-offset-2">{part}</strong>
        : <span key={i}>{part}</span>
    ))
  }

  const typingLabels = Object.values(typing).filter(Boolean)
  const input = 'flex-1 min-w-0 rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900'

  return (
    <aside className="absolute inset-y-0 right-0 z-10 w-full sm:w-96 bg-white shadow-xl flex flex-col" aria-label={t('chat')}>
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-neutral-100">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-neutral-900 truncate">{t('chat')}</h3>
          {online.length > 0 && (
            <p className="text-xs text-neutral-500 truncate">{t('chatOnline')}: {online.map((o) => o.label || '·').join(', ')}</p>
          )}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 text-sm text-neutral-500 hover:text-neutral-900">{t('close')}</button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && !err && <p className="text-sm text-neutral-400">{t('chatEmpty')}</p>}
        {messages.map((m) => {
          const label = labelOf(m.user_id) || '…'
          const mine = m.user_id === user.id
          return (
            <div key={m.id} className="flex gap-3">
              <Avatar name={label} email={label} url={null} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-neutral-500">
                  <span className="font-medium text-neutral-800">{mine ? t('you') : label}</span>
                  {' · '}{new Date(m.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  {mine && (
                    <button type="button" onClick={() => remove(m)} aria-label={t('delete')}
                      className="ms-2 text-neutral-400 hover:text-neutral-900">{t('delete')}</button>
                  )}
                </p>
                <p className="text-sm text-neutral-900 whitespace-pre-wrap break-words">{render(m.content)}</p>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <footer className="px-5 pb-5 pt-2 border-t border-neutral-100 space-y-2">
        {typingLabels.length > 0 && (
          <p className="text-xs text-neutral-500">{typingLabels.join(', ')} {t('chatTyping')}</p>
        )}
        {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
        {canWrite ? (
          <form onSubmit={send} className="flex gap-2">
            <input className={input} value={text} maxLength={2000} disabled={busy}
              placeholder={t('chatPlaceholder')} aria-label={t('chatPlaceholder')} onChange={(e) => onTyping(e.target.value)} />
            <button type="submit" disabled={busy || !text.trim()}
              className="shrink-0 px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('chatSend')}</button>
          </form>
        ) : (
          <p className="text-xs text-neutral-500">{t('chatReadOnly')}</p>
        )}
      </footer>
    </aside>
  )
}
