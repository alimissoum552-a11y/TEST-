import { useState } from 'react'
import { supabase } from './lib/supabase.js'

export default function AuthScreen() {
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
      setMessage({ type: 'ok', text: 'Vérifiez votre email pour confirmer le compte.' })
  }

  const input = 'w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900'

  return (
    <div className="min-h-screen bg-neutral-200 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {mode === 'signin' ? 'Connexion' : 'Créer un compte'}
        </h1>
        {mode === 'signup' && (
          <input className={input} placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" required minLength={6} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
        {message && (
          <p className={`text-sm ${message.type === 'error' ? 'text-neutral-900 font-medium' : 'text-neutral-600'}`}>{message.text}</p>
        )}
        <button disabled={busy} className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm hover:bg-neutral-700 disabled:opacity-50">
          {busy ? '…' : mode === 'signin' ? 'Se connecter' : 'Créer le compte'}
        </button>
        <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null) }}
          className="w-full text-sm text-neutral-500 hover:text-neutral-800">
          {mode === 'signin' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
        </button>
      </form>
    </div>
  )
}
