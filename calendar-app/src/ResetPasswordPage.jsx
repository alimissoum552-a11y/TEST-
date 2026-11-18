import { useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { supabase } from './lib/supabase.js'
import { listPasskeys, removeAllPasskeys } from './passkeys.js'
import { passwordProblem, MIN_PASSWORD_LENGTH } from './lib/passwordCheck.js'

// Reached after a successful passkey check: the user is signed in and chooses a new password.
export default function ResetPasswordPage({ byEmail = false }) {
  const { t } = useI18n()
  const [dropPasskeys, setDropPasskeys] = useState(byEmail)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const input = 'w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900'

  async function save(e) {
    e.preventDefault()
    setMsg(null)
    if (password !== confirm) { setMsg({ err: true, text: t('resetMismatch') }); return }
    setBusy(true)
    const problem = await passwordProblem(password)
    if (problem) { setBusy(false); setMsg({ err: true, text: t(problem === 'passwordTooShort' ? 'resetTooShort' : problem) }); return }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setBusy(false); setMsg({ err: true, text: error.message }); return }
    // After an e-mail recovery the lost device's passkeys can be removed here (Supabase also notifies by e-mail).
    if (byEmail && dropPasskeys) {
      try {
        const { data } = await supabase.auth.getUser()
        if (data?.user?.id) await removeAllPasskeys(data.user.id)
      } catch { setBusy(false); setMsg({ err: true, text: t('resetPasskeysFailed') }); return }
    }
    setBusy(false)
    window.location.hash = ''
  }

  return (
    <div className="min-h-screen bg-neutral-200 flex items-center justify-center p-4">
      <form onSubmit={save} className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-900">{t('resetNewTitle')}</h1>

        <div className="relative">
          <input className={input} type={show ? 'text' : 'password'} required minLength={MIN_PASSWORD_LENGTH}
            placeholder={t('resetNewPassword')} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? t('hidePassword') : t('showPassword')}
            className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 hover:text-neutral-900">
            {show ? <EyeOff /> : <Eye />}
          </button>
        </div>
        <input className={input} type={show ? 'text' : 'password'} required minLength={MIN_PASSWORD_LENGTH}
          placeholder={t('resetConfirm')} value={confirm} onChange={(e) => setConfirm(e.target.value)} />

        {byEmail && (
          <label className="flex items-start gap-3 text-sm text-neutral-800">
            <input type="checkbox" checked={dropPasskeys} onChange={(e) => setDropPasskeys(e.target.checked)} className="mt-1" />
            <span>{t('resetDropPasskeys')}<span className="block text-xs text-neutral-500">{t('resetDropPasskeysHint')}</span></span>
          </label>
        )}

        {msg && <p className={`text-sm ${msg.err ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>{msg.text}</p>}

        <button disabled={busy} className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">
          {busy ? '…' : t('resetSave')}
        </button>
        <button type="button" onClick={() => { window.location.hash = '' }}
          className="w-full text-sm text-neutral-500 hover:text-neutral-800">{t('resetCancel')}</button>
      </form>
    </div>
  )
}

export function Eye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  )
}

export function EyeOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M4 4l16 16" />
      <path d="M9.9 5.7A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.9" />
      <path d="M6.3 7.9A16.6 16.6 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9.8 9.8 0 0 0 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}
