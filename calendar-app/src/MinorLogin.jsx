import { useState } from 'react'
import { useI18n, LanguageSelect, LanguageButton } from './i18n/index.jsx'
import { minorLogin } from './lib/api.js'
import Logo from './Logo.jsx'

const field = 'w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 bg-white'

// Access for a minor: the e-mail of the team owner and the access ID given by the adult in charge.
// Every failure shows the same message, so nothing is revealed about which part was wrong.
export default function MinorLogin() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [id, setId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [langOpen, setLangOpen] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await minorLogin(email.trim(), id)
      window.location.hash = ''
    } catch (ex) {
      setErr(ex.message === 'too_many_attempts' ? t('mlLocked') : t('mlErr'))
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-6 md:p-8 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="relative">
            <LanguageButton open={langOpen} onToggle={() => setLangOpen((o) => !o)} />
            {langOpen && <LanguageSelect onPick={() => setLangOpen(false)} placement="down" />}
          </div>
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">{t('mlTitle')}</h1>
        <p className="text-sm text-neutral-600">{t('mlIntro')}</p>

        <div className="space-y-1">
          <label htmlFor="ml-email" className="block text-sm font-medium text-neutral-900">{t('mlEmail')}</label>
          <input id="ml-email" type="email" required autoComplete="off" className={field} value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="ml-id" className="block text-sm font-medium text-neutral-900">{t('mlId')}</label>
          <input id="ml-id" required autoComplete="off" autoCapitalize="characters" spellCheck={false}
            className={`${field} font-mono tracking-widest`} value={id} maxLength={20}
            onChange={(e) => setId(e.target.value)} />
        </div>

        {err && <p role="alert" className="text-sm font-medium text-neutral-900">{err}</p>}
        <button type="submit" disabled={busy || !email.trim() || !id.trim()}
          className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{busy ? '…' : t('mlSubmit')}</button>
        <button type="button" onClick={() => { window.location.hash = '/signin' }}
          className="w-full text-sm text-neutral-600 underline underline-offset-2">{t('mlBack')}</button>
      </form>
    </div>
  )
}
