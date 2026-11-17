import { useEffect, useState } from 'react'
import { useI18n, LanguageSelect, LanguageButton } from './i18n/index.jsx'
import { getConsentInfo, approveConsent } from './lib/api.js'

// Page opened from the e-mail sent to the guardian of a child under 13: #/consent?token=...
// No sign-in. The guardian reads what is collected and approves with one button. The link works once.
export default function ConsentPage({ token }) {
  const { t } = useI18n()
  const [info, setInfo] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | done | expired | used | invalid | error
  const [busy, setBusy] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    getConsentInfo(token)
      .then((res) => { setInfo(res); setState('ready') })
      .catch((ex) => setState(({ expired: 'expired', already_used: 'used', invalid_link: 'invalid' })[ex.message] || 'error'))
  }, [token])

  async function approve() {
    setBusy(true)
    try { await approveConsent(token); setState('done') }
    catch (ex) { setState(({ expired: 'expired', already_used: 'used', invalid_link: 'invalid' })[ex.message] || 'error') }
    finally { setBusy(false) }
  }

  const goHome = () => { window.location.hash = '' }
  const text = (key) => t(key)
    .replace('{owner}', info?.owner_name || '').replace('{child}', info?.first_name || '').replace('{team}', info?.team_name || '')

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 md:p-8 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">Collyo</span>
          <div className="relative">
            <LanguageButton open={langOpen} onToggle={() => setLangOpen((o) => !o)} />
            {langOpen && <LanguageSelect onPick={() => setLangOpen(false)} placement="down" />}
          </div>
        </div>

        <h1 className="text-xl font-semibold text-neutral-900">{t('consTitle')}</h1>

        {state === 'loading' && <p className="text-sm text-neutral-400">…</p>}

        {state === 'ready' && info && (
          <>
            <p className="text-sm text-neutral-800">{text('consIntro')}</p>
            <ul className="list-disc ps-5 space-y-1.5 text-sm text-neutral-700">
              <li>{t('consData')}{info.has_sex ? ` ${t('consSex')}` : ''}{info.category ? ` ${t('consCategory')}: ${info.category}.` : ''}</li>
              {info.owner_email_masked && <li>{t('consOwner').replace('{email}', info.owner_email_masked)}</li>}
              <li>{t('consWhat')}</li>
              <li>{t('consWithdraw')}</li>
            </ul>
            <button type="button" onClick={approve} disabled={busy}
              className="w-full py-3 rounded-xl bg-neutral-900 text-white text-sm font-medium disabled:opacity-50">{t('consApprove')}</button>
          </>
        )}

        {state === 'done' && (
          <>
            <p className="text-sm text-neutral-800">{t('consDone')}</p>
            <button type="button" onClick={goHome} className="text-sm text-neutral-900 underline underline-offset-2">{t('consHome')}</button>
          </>
        )}
        {state === 'expired' && <p className="text-sm text-neutral-800">{t('consExpired')}</p>}
        {state === 'used' && <p className="text-sm text-neutral-800">{t('consUsed')}</p>}
        {state === 'invalid' && <p className="text-sm text-neutral-800">{t('consInvalid')}</p>}
        {state === 'error' && <p className="text-sm text-neutral-800">{t('famErrGeneric')}</p>}
      </div>
    </div>
  )
}
