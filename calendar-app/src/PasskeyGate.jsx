import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { supabase } from './lib/supabase.js'
import { verifyWithPasskey } from './passkeys.js'

// The account has a passkey: after the password step, the device must confirm
// it is really the owner before the calendar opens.
export default function PasskeyGate({ onVerified }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function confirm() {
    setBusy(true); setErr(null)
    try { await verifyWithPasskey(); onVerified() }
    catch (e) {
      setErr(e?.name === 'NotAllowedError' ? t('passkeyCancelled') : t('passkeyFailed'))
    } finally { setBusy(false) }
  }

  useEffect(() => { confirm() }, [])

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-5 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className="mx-auto h-12 w-12" aria-hidden="true">
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V8a4 4 0 0 1 7.5-2" />
          <circle cx="12" cy="15.5" r="1.2" />
        </svg>
        <h1 className="text-xl font-semibold">{t('passkeyGateTitle')}</h1>
        <p className="text-sm text-white/60">{t('passkeyGateBody')}</p>
        {err && <p className="text-sm text-white">{err}</p>}
        <button onClick={confirm} disabled={busy}
          className="w-full py-3 rounded-xl bg-white text-neutral-900 text-sm font-medium disabled:opacity-40">
          {busy ? '…' : t('passkeyGateConfirm')}
        </button>
        <button type="button" onClick={() => supabase.auth.signOut()} className="text-xs text-white/60 hover:text-white">
          {t('passkeyGateSignOut')}
        </button>
      </div>
    </div>
  )
}
