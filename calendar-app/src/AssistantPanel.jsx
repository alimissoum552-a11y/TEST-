import { useEffect, useRef, useState } from 'react'
import AiAvatar from './AiAvatar.jsx'
import { useI18n } from './i18n/index.jsx'
import { askAssistant, getAiAcceptedAt, acceptAssistantPolicy, getAiPermissions, setAiPermissions, getWellbeingSettings, saveWellbeingSettings } from './lib/api.js'

// Conversation with the scheduling assistant. Read-only: it suggests times, the user creates events.
// Answers are shown as plain text (never as HTML).
const ERROR_KEYS = {
  daily_limit: 'assistantLimit',
  assistant_not_configured: 'assistantNotConfigured',
}

export default function AssistantPanel({ user, onClose, onApplied, onOpenWellbeing }) {
  const { t, locale } = useI18n()
  const [accepted, setAccepted] = useState(undefined) // undefined = loading
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [perms, setPerms] = useState({ can_create: false, can_update: false, can_delete: false })
  const endRef = useRef(null)

  useEffect(() => {
    getAiPermissions(user.id).then(setPerms).catch(() => {})
  }, [user.id])

  // Well-being mode for the personal assistant. Without a profile yet, the form opens first.
  const [wbRow, setWbRow] = useState(undefined) // undefined = loading, null = no settings yet
  const [wbBusy, setWbBusy] = useState(false)
  const wbOn = !!wbRow?.mode_enabled
  useEffect(() => {
    getWellbeingSettings(user.id).then(setWbRow).catch(() => setWbRow(null))
  }, [user.id])
  async function toggleWellbeing() {
    if (!wbRow) { onOpenWellbeing?.(); return }
    setWbBusy(true)
    try { setWbRow(await saveWellbeingSettings(user.id, { mode_enabled: !wbRow.mode_enabled })) }
    catch (ex) { setErr(ex.message) } finally { setWbBusy(false) }
  }

  async function togglePerm(key) {
    const next = { ...perms, [key]: !perms[key] }
    setPerms(next)
    try { await setAiPermissions(user.id, { [key]: next[key] }) }
    catch (ex) { setPerms(perms); setErr(ex.message) }
  }

  useEffect(() => {
    getAiAcceptedAt(user.id).then((at) => setAccepted(Boolean(at))).catch(() => setAccepted(false))
  }, [user.id])

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [messages, busy])

  async function accept() {
    try { await acceptAssistantPolicy(user.id); setAccepted(true) } catch (ex) { setErr(ex.message) }
  }

  async function send(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content || busy) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next); setText(''); setBusy(true); setErr(null)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const res = await askAssistant(next.map(({ role, content: c }) => ({ role, content: c })), timezone, locale)
      setMessages([...next, { role: 'assistant', content: res.reply, consulted: res.consulted || [], applied: res.applied || [] }])
      if (res.applied?.length) onApplied?.()
    } catch (ex) {
      if (ex.message === 'consent_required') setAccepted(false)
      setErr(t(ERROR_KEYS[ex.message] || 'assistantError'))
    } finally { setBusy(false) }
  }

  const input = 'flex-1 min-w-0 rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900'

  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl flex flex-col gap-4 max-h-[90%]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-neutral-900">{t('assistant')}</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleWellbeing} aria-pressed={wbOn} disabled={wbBusy}
              aria-label={wbOn ? t('wbChatOff') : t('wbChatOn')} title={wbOn ? t('wbChatOff') : t('wbChatOn')}
              className={`rounded-full px-2.5 py-1 text-xs border transition-colors disabled:opacity-50 ${wbOn ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-600 hover:text-neutral-900'}`}>
              {t('wbMenu')}
            </button>
            <button type="button" onClick={() => setSettingsOpen((o) => !o)} aria-label={t('aiSettings')} aria-expanded={settingsOpen}
              className={`p-1.5 transition-colors ${settingsOpen ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <circle cx="12" cy="12" r="3.2" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </button>
            <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">{t('close')}</button>
          </div>
        </div>

        {settingsOpen && (
          <div className="rounded-2xl border border-neutral-200 p-4 space-y-3">
            <p className="text-sm font-medium text-neutral-900">{t('aiSettings')}</p>
            {[
              ['can_create', 'aiPermCreate'],
              ['can_update', 'aiPermUpdate'],
              ['can_delete', 'aiPermDelete'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-start gap-3 text-sm text-neutral-800">
                <input type="checkbox" checked={!!perms[key]} onChange={() => togglePerm(key)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-900" />
                <span>{t(label)}</span>
              </label>
            ))}
            <p className="text-xs text-neutral-500">{t('aiPermNote')}</p>
            <button type="button" onClick={() => { window.location.hash = '/ai-guide' }}
              className="text-xs text-neutral-900 underline underline-offset-2">{t('aiGuide')} →</button>
          </div>
        )}

        {accepted === undefined && <p className="text-sm text-neutral-400">…</p>}

        {accepted === false && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-700 whitespace-pre-line">{t('assistantIntro')}</p>
            {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
            <button type="button" onClick={accept} className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm">{t('assistantAccept')}</button>
          </div>
        )}

        {accepted === true && (
          <>
            <div className="flex-1 min-h-[12rem] overflow-y-auto space-y-3 pr-1">
              {messages.length === 0 && <p className="text-sm text-neutral-400">{t('assistantEmpty')}</p>}
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'ms-auto max-w-[85%]' : 'flex items-start gap-2 me-auto max-w-[92%]'}>
                  {m.role === 'assistant' && <AiAvatar size="sm" label={t('assistant')} />}
                  <div className="min-w-0">
                    <p className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                      {m.content}
                    </p>
                    {m.role === 'assistant' && m.consulted?.length > 0 && (
                      <p className="mt-1 text-xs text-neutral-500">{t('assistantConsulted')} {m.consulted.join(', ')}</p>
                    )}
                    {m.role === 'assistant' && m.applied?.length > 0 && (
                      <p className="mt-1 text-xs text-neutral-600">{t('aiApplied')}: {m.applied.map((a) => `${a.action} — ${a.title}`).join(', ')}</p>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2">
                  <AiAvatar active size="sm" label={t('assistant')} />
                  <p className="text-sm text-neutral-400">…</p>
                </div>
              )}
              <div ref={endRef} />
            </div>
            {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
            <form onSubmit={send} className="flex gap-2">
              <input className={input} value={text} maxLength={2000} disabled={busy}
                placeholder={t('assistantPlaceholder')} onChange={(e) => setText(e.target.value)} aria-label={t('assistantPlaceholder')} />
              <button type="submit" disabled={busy || !text.trim()}
                className="shrink-0 px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('assistantSend')}</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
