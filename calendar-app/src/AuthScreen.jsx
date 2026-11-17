import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { useI18n, LanguageSelect, LanguageButton } from './i18n/index.jsx'
import { goLegal, parseRoute } from './router.js'
import { signInWithPasskey } from './passkeys.js'
import { Eye, EyeOff } from './ResetPasswordPage.jsx'

export default function AuthScreen({ initialError = null }) {
  const { t } = useI18n()
  const [langOpen, setLangOpen] = useState(false)
  // Mode is read from the URL (#/signin or #/signup) so returning from a legal page restores it.
  const initial = parseRoute(typeof window !== 'undefined' ? window.location.hash : '').auth || 'signin'
  const [mode, setModeState] = useState(initial)
  const setMode = (m) => {
    setModeState(m)
    window.location.hash = `/${m}`
  }
  useEffect(() => {
    const onHash = () => {
      const a = parseRoute(window.location.hash).auth
      if (a) setModeState(a)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [message, setMessage] = useState(initialError ? { type: 'error', text: t(initialError) } : null)
  const [showPassword, setShowPassword] = useState(false)
  const [resetStep, setResetStep] = useState(null) // null | 'email'

  async function submit(e) {
    e.preventDefault()
    if (mode === 'signup' && !accepted) { setMessage({ type: 'error', text: t('mustAcceptTerms') }); return }
    setBusy(true); setMessage(null)
    const res = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } })
    setBusy(false)
    if (res.error) setMessage({ type: 'error', text: res.error.message })
    else if (mode === 'signup' && !res.data.session)
      setMessage({ type: 'ok', text: t('checkEmail') })
  }

  const input = 'w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900'

  return (
    <div className="min-h-screen bg-neutral-200 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-3">
      <form onSubmit={submit} className="bg-white rounded-3xl shadow-xl p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {mode === 'signin' ? t('signIn') : t('createAccount')}
        </h1>
        {mode === 'signup' && (
          <input className={input} placeholder={t('name')} value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className={input} type="email" required placeholder={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="relative">
          <input className={input + ' pe-11'} type={showPassword ? 'text' : 'password'} required minLength={6}
            placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 hover:text-neutral-900">
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        </div>
        {message && (
          <p className={`text-sm ${message.type === 'error' ? 'text-neutral-900 font-medium' : 'text-neutral-600'}`}>{message.text}</p>
        )}
        {mode === 'signin' && !resetStep && (
          <button type="button" onClick={() => { setResetStep('email'); setMessage(null) }}
            className="text-sm text-neutral-500 hover:text-neutral-900">{t('forgotPassword')}</button>
        )}
        {resetStep === 'email' && (
          <div className="rounded-2xl border border-neutral-200 p-4 space-y-2">
            <p className="text-sm text-neutral-700">{t('resetEmailBody')}</p>
            <div className="flex gap-2">
              <button type="button" onClick={async () => {
                setMessage(null)
                if (!email.trim()) { setMessage({ type: 'error', text: t('passkeyNeedEmail') }); return }
                setBusy(true)
                try {
                  await signInWithPasskey(email.trim().toLowerCase())
                  window.location.hash = '/reset-password'
                } catch (ex) {
                  const code = ex?.message || ''
                  if (code === 'no_passkey') {
                    // No passkey on this account: send a reset link to the e-mail instead.
                    const redirectTo = `${window.location.origin}/#/reset-password`
                    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo })
                    setMessage(error
                      ? { type: 'error', text: error.message }
                      : { type: 'ok', text: t('resetLinkSent') })
                    setResetStep(null)
                  } else {
                    setMessage({ type: 'error', text: ex?.name === 'NotAllowedError' ? t('passkeyCancelled') : t('resetFailed') })
                  }
                } finally { setBusy(false) }
              }} disabled={busy}
                className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('resetContinue')}</button>
              <button type="button" onClick={() => { setResetStep(null); setMessage(null) }}
                className="px-3 py-2 rounded-xl bg-neutral-100 text-sm">{t('cancel')}</button>
            </div>
          </div>
        )}
        {mode === 'signup' && (
          <label className="flex items-start gap-2 text-xs leading-relaxed text-neutral-600">
            <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-900" />
            <span>
              {t('consentPrefix')}{' '}
              <button type="button" onClick={() => goLegal('terms', mode)} className="underline underline-offset-2 hover:text-neutral-900">{t('termsLink')}</button>,{' '}
              <button type="button" onClick={() => goLegal('privacy', mode)} className="underline underline-offset-2 hover:text-neutral-900">{t('privacyLink')}</button>{' '}
              {t('andCookies')}{' '}
              <button type="button" onClick={() => goLegal('cookies', mode)} className="underline underline-offset-2 hover:text-neutral-900">{t('cookiesLink')}</button>.
            </span>
          </label>
        )}
        <button disabled={busy} className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm hover:bg-neutral-700 disabled:opacity-50">
          {busy ? '…' : mode === 'signin' ? t('signIn') : t('createAccount')}
        </button>
        <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null) }}
          className="w-full text-sm text-neutral-500 hover:text-neutral-800">
          {mode === 'signin' ? t('noAccount') : t('haveAccount')}
        </button>
        <div className="relative flex justify-center pt-2">
          <LanguageButton open={langOpen} onToggle={() => setLangOpen((o) => !o)} />
          {langOpen && <LanguageSelect onPick={() => setLangOpen(false)} placement="down" />}
        </div>
      </form>
      </div>
    </div>
  )
}
