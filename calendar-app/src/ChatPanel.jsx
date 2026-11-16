import { useEffect, useRef, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import Avatar from './Avatar.jsx'
import { supabase } from './lib/supabase.js'
import {
  listMembers, listMessages, sendMessage, deleteMessage, getNamesByIds,
  getChatAi, setChatAi, askChatAi, getChatNotes,
} from './lib/api.js'

// Team chat for one calendar: history from the database, new messages by Realtime (Postgres Changes),
// online members by Presence, "is typing" by Broadcast. Readers can read but not write.
// The owner can switch the AI on for this chat. Once on, a message that mentions @AI gets a reply from the AI.
const TYPING_SEND_MS = 2000
const TYPING_HIDE_MS = 3000
const MENTION = /@(ai|ia|ki)\b/i
const AI_ERRORS = { ai_disabled: 'chatAiDisabled', daily_limit: 'assistantLimit', assistant_not_configured: 'assistantNotConfigured' }

// Sparkle icon, same drawing as the menu icon. Filled and pulsing when the AI is on; outline when off.
function Sparkle({ on }) {
  return (
    <svg viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M9.5 4.5c.4 3 2.1 4.8 5.1 5.2-3 .4-4.7 2.2-5.1 5.2-.4-3-2.1-4.8-5.1-5.2 3-.4 4.7-2.2 5.1-5.2z" />
      <path d="M18 3.5c.2 1.4.9 2.1 2.3 2.3-1.4.2-2.1.9-2.3 2.3-.2-1.4-.9-2.1-2.3-2.3 1.4-.2 2.1-.9 2.3-2.3z" />
      <path d="M17.5 14.5c.15 1 .6 1.45 1.6 1.6-1 .15-1.45.6-1.6 1.6-.15-1-.6-1.45-1.6-1.6 1-.15 1.45-.6 1.6-1.6z" />
    </svg>
  )
}

export default function ChatPanel({ calendarId, user, myHandle, canWrite, isOwner, onClose }) {
  const { t, locale } = useI18n()
  const myLabel = user.user_metadata?.display_name || user.email || ''
  const [messages, setMessages] = useState([])
  const [names, setNames] = useState({})
  const [handles, setHandles] = useState({}) // user_id -> handle
  const [candidates, setCandidates] = useState([]) // members who can be mentioned
  const [online, setOnline] = useState([])
  const [typing, setTyping] = useState({}) // user_id -> label
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [aiOn, setAiOn] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [confirmAi, setConfirmAi] = useState(false)
  const [notes, setNotes] = useState(null)
  const channelRef = useRef(null)
  const lastTypingSent = useRef(0)
  const typingTimers = useRef({})
  const endRef = useRef(null)

  // 1. History, AI switch, shared notes
  useEffect(() => {
    let cancelled = false
    listMessages(calendarId)
      .then((rows) => { if (!cancelled) setMessages(rows) })
      .catch((ex) => { if (!cancelled) setErr(ex.message) })
    getChatAi(calendarId).then((v) => { if (!cancelled) setAiOn(v) }).catch(() => {})
    getChatNotes(calendarId).then((n) => { if (!cancelled) setNotes(n) }).catch(() => {})
    return () => { cancelled = true }
  }, [calendarId])

  // 2. Names of authors not yet known
  useEffect(() => {
    const missing = [...new Set(messages.filter((m) => !m.is_ai).map((m) => m.user_id))].filter((id) => !names[id])
    if (!missing.length) return
    getNamesByIds(missing)
      .then((rows) => {
        setNames((prev) => ({ ...prev, ...Object.fromEntries(rows.map((r) => [r.id, r.display_name || r.email])) }))
        setHandles((prev) => ({ ...prev, ...Object.fromEntries(rows.map((r) => [r.id, r.handle])) }))
      })
      .catch(() => {})
  }, [messages, names])

  // Members who can be mentioned with @handle (autocomplete).
  useEffect(() => {
    let cancelled = false
    listMembers(calendarId).then((rows) => {
      if (cancelled) return
      setCandidates((rows || []).filter((r) => r.profiles?.handle).map((r) => ({ id: r.user_id, handle: r.profiles.handle })))
      setHandles((prev) => ({ ...prev, ...Object.fromEntries((rows || []).filter((r) => r.profiles?.handle).map((r) => [r.user_id, r.profiles.handle])) }))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [calendarId])

  // 3. Realtime: messages, presence, typing, the AI switch and the shared notes
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
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calendars', filter: `id=eq.${calendarId}` },
        (p) => setAiOn(Boolean(p.new.chat_ai_enabled)))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_ai_notes', filter: `calendar_id=eq.${calendarId}` },
        (p) => setNotes(p.new ? { content: p.new.content, updated_at: p.new.updated_at } : null))
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
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [messages.length, aiThinking])

  const labelOf = (m) => (m.is_ai ? t('chatAiName') : m.user_id === user.id ? myLabel : names[m.user_id] || '')

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
      if (aiOn && MENTION.test(content)) await requestAi()
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  // The AI's reply arrives as a chat message through Realtime.
  async function requestAi() {
    setAiThinking(true)
    try { await askChatAi(calendarId) } catch (ex) { setErr(t(AI_ERRORS[ex.message] || 'chatAiFailed')) } finally { setAiThinking(false) }
  }

  async function toggleAi() {
    if (!aiOn) { setConfirmAi(true); return }
    try { setAiOn(await setChatAi(calendarId, false)) } catch (ex) { setErr(ex.message) }
  }

  async function confirmEnableAi() {
    setConfirmAi(false)
    try { setAiOn(await setChatAi(calendarId, true)) } catch (ex) { setErr(ex.message) }
  }

  async function remove(m) {
    try {
      await deleteMessage(m.id)
      setMessages((prev) => prev.filter((x) => x.id !== m.id))
    } catch (ex) { setErr(ex.message) }
  }

  // @name is highlighted when it names the signed-in user.
  function render(content) {
    const me = (myHandle || '').toLowerCase()
    return content.split(/(@[^\s@]{1,60})/g).map((part, i) => (
      part.startsWith('@') && me && part.slice(1).toLowerCase() === me
        ? <strong key={i} className="font-semibold underline underline-offset-2">{part}</strong>
        : <span key={i}>{part}</span>
    ))
  }

  const typingLabels = Object.values(typing).filter(Boolean)
  // While typing @xyz, suggest members whose handle starts with xyz.
  const partial = text.match(/@(\w*)$/)
  const suggestions = partial
    ? candidates.filter((c) => c.id !== user.id && c.handle.startsWith(partial[1].toLowerCase())).slice(0, 5)
    : []
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
        <div className="flex items-center gap-3 shrink-0">
          {isOwner && (
            <button type="button" onClick={toggleAi} aria-pressed={aiOn}
              aria-label={aiOn ? t('chatAiOn') : t('chatAiOff')} title={aiOn ? t('chatAiOn') : t('chatAiOff')}
              className={`rounded-full p-1 transition-colors ${aiOn ? 'text-neutral-900 motion-safe:animate-pulse drop-shadow-[0_0_6px_rgba(23,23,23,0.55)]' : 'text-neutral-400 hover:text-neutral-800'}`}>
              <Sparkle on={aiOn} />
            </button>
          )}
          <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">{t('close')}</button>
        </div>
      </header>

      {aiOn && (
        <div className="px-5 py-3 border-b border-neutral-100 space-y-2 bg-neutral-50">
          <p className="text-xs text-neutral-600">{t('chatAiBanner')}</p>
          <details>
            <summary className="cursor-pointer text-xs font-medium text-neutral-800">{t('chatAiNotes')}</summary>
            <p className="mt-2 text-xs text-neutral-700 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
              {notes?.content || t('chatAiNoNotes')}
            </p>
          </details>
        </div>
      )}

      {confirmAi && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <h4 className="text-base font-semibold text-neutral-900">{t('chatAiConfirmTitle')}</h4>
            <p className="text-sm text-neutral-700">{t('chatAiConfirmText')}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmAi(false)} className="flex-1 py-2 rounded-xl bg-neutral-100 text-sm">{t('chatAiCancel')}</button>
              <button type="button" onClick={confirmEnableAi} className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm">{t('chatAiConfirm')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && !err && <p className="text-sm text-neutral-400">{t('chatEmpty')}</p>}
        {messages.map((m) => {
          const label = labelOf(m) || '…'
          const mine = !m.is_ai && m.user_id === user.id
          return (
            <div key={m.id} className="flex gap-3">
              {m.is_ai
                ? <span aria-hidden="true" className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full border border-neutral-900 text-neutral-900"><Sparkle on={false} /></span>
                : <Avatar name={label} email={label} url={null} />}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-neutral-500">
                  <span className="font-medium text-neutral-800">{mine ? t('you') : label}</span>
                  {!mine && handles[m.user_id] && <span className="text-neutral-400"> @{handles[m.user_id]}</span>}
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
        {aiThinking && <p className="text-xs text-neutral-500 motion-safe:animate-pulse">{t('chatAiThinking')}</p>}
        <div ref={endRef} />
      </div>

      <footer className="px-5 pb-5 pt-2 border-t border-neutral-100 space-y-2">
        {typingLabels.length > 0 && (
          <p className="text-xs text-neutral-500">{typingLabels.join(', ')} {t('chatTyping')}</p>
        )}
        {suggestions.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={t('mentionSuggest')}>
            {suggestions.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setText(text.replace(/@\w*$/, `@${c.handle} `))}
                  className="px-3 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs text-neutral-900">@{c.handle}</button>
              </li>
            ))}
          </ul>
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
