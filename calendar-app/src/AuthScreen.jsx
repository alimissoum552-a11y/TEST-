import { useState } from 'react'
import { supabase } from './lib/supabase.js'
import { useI18n, LanguageSelect } from './i18n/index.jsx'

export default function AuthScreen() {
  const { t } = useI18n()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  async function submit(e) {
    e.preventDefault()
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
        <div className="flex justify-end relative"><LanguageSelect /></div>
      <form onSubmit={submit} className="bg-white rounded-3xl shadow-xl p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {mode === 'signin' ? t('signIn') : t('createAccount')}
        </h1>
        {mode === 'signup' && (
          <input className={input} placeholder={t('name')} value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className={input} type="email" required placeholder={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" required minLength={6} placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} />
        {message && (
          <p className={`text-sm ${message.type === 'error' ? 'text-neutral-900 font-medium' : 'text-neutral-600'}`}>{message.text}</p>
        )}
        <button disabled={busy} className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm hover:bg-neutral-700 disabled:opacity-50">
          {busy ? '…' : mode === 'signin' ? 'Se connecter' : 'Créer le compte'}
        </button>
        <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null) }}
          className="w-full text-sm text-neutral-500 hover:text-neutral-800">
          {mode === 'signin' ? t('noAccount') : t('haveAccount')}
        </button>
      </form>
      </div>
    </div>
  )
}
