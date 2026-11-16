import { useEffect, useRef, useState } from 'react'
import AiAvatar from './AiAvatar.jsx'
import { useI18n } from './i18n/index.jsx'
import { askAssistant, getAiAcceptedAt, acceptAssistantPolicy } from './lib/api.js'

// Conversation with the scheduling assistant. Read-only: it suggests times, the user creates events.
// Answers are shown as plain text (never as HTML).
const ERROR_KEYS = {
  daily_limit: 'assistantLimit',
  assistant_not_configured: 'assistantNotConfigured',
}

export default function AssistantPanel({ user, onClose }) {
  const { t, locale } = useI18n()
  const [accepted, setAccepted] = useState(undefined) // undefined = loading
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const endRef = useRef(null)

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
      setMessages([...next, { role: 'assistant', content: res.reply, consulted: res.consulted || [] }])
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
          <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">{t('close')}</button>
        </div>

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
