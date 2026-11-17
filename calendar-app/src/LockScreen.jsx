import { useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { verifyPasscode } from './lock.js'

// Shown instead of the app when the local passcode is enabled and the app is locked.
export default function LockScreen({ onUnlock }) {
  const { t } = useI18n()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const ok = await verifyPasscode(pin)
    setBusy(false)
    if (ok) onUnlock()
    else { setErr(t('lockWrong')); setPin('') }
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-xs space-y-5 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className="mx-auto h-12 w-12" aria-hidden="true">
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
          <circle cx="12" cy="15.5" r="1.2" />
        </svg>
        <h1 className="text-xl font-semibold">{t('lockTitle')}</h1>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          inputMode="numeric" autoComplete="off" autoFocus placeholder={t('lockPlaceholder')} aria-label={t('lockPlaceholder')}
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-center text-lg tracking-[0.4em] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40" />
        {err && <p className="text-sm text-white">{err}</p>}
        <button disabled={busy || pin.length < 4}
          className="w-full py-3 rounded-xl bg-white text-neutral-900 text-sm font-medium disabled:opacity-40">{t('lockUnlock')}</button>
        <button type="button" onClick={() => { window.location.href = '/#/signin' }} className="text-xs text-white/60 hover:text-white">
          {t('lockSwitchAccount')}
        </button>
      </form>
    </div>
  )
}
