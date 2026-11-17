import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { verifyPasskey } from './lock.js'

// Shown instead of the app when the device lock is on: the phone or browser asks for
// the user's own unlock (biometrics or device passcode).
export default function LockScreen({ onUnlock }) {
  const { t } = useI18n()
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function unlock() {
    setBusy(true); setErr(null)
    try {
      if (await verifyPasskey()) onUnlock()
      else setErr(t('lockFailed'))
    } catch (e) {
      setErr(e?.name === 'NotAllowedError' ? t('lockCancelled') : t('lockFailed'))
    } finally { setBusy(false) }
  }

  // Try once as soon as the screen appears, so unlocking feels like opening the phone.
  useEffect(() => { unlock() }, [])

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-5 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className="mx-auto h-12 w-12" aria-hidden="true">
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
          <circle cx="12" cy="15.5" r="1.2" />
        </svg>
        <h1 className="text-xl font-semibold">{t('lockTitle')}</h1>
        <p className="text-sm text-white/60">{t('lockBody')}</p>
        {err && <p className="text-sm text-white">{err}</p>}
        <button onClick={unlock} disabled={busy}
          className="w-full py-3 rounded-xl bg-white text-neutral-900 text-sm font-medium disabled:opacity-40">
          {busy ? '…' : t('lockUnlock')}
        </button>
        <button type="button" onClick={() => { window.location.href = '/#/signin' }} className="text-xs text-white/60 hover:text-white">
          {t('lockSwitchAccount')}
        </button>
      </div>
    </div>
  )
}
