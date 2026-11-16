import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { useI18n } from './i18n/index.jsx'

// Consent screen for apps that connect to the calendar through OAuth (for example Claude).
// Reached from #/oauth/consent?authorization_id=<id>, after sign-in. Supabase Auth issues the code
// after the user's decision, so this page only shows the request and sends the answer.
const READ_SCOPES = ['openid', 'profile', 'email']

export default function OAuthConsentPage({ authorizationId }) {
  const { t } = useI18n()
  const [details, setDetails] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.oauth.getAuthorizationDetails(authorizationId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setErr(error.message); return }
        // Consent already given: Supabase returns the redirect directly.
        if (data && !('authorization_id' in data)) { window.location.href = data.redirect_url; return }
        setDetails(data)
      })
      .catch((ex) => { if (!cancelled) setErr(ex.message) })
    return () => { cancelled = true }
  }, [authorizationId])

  async function decide(approve) {
    setBusy(true); setErr(null)
    try {
      const api = supabase.auth.oauth
      const opts = { skipBrowserRedirect: true }
      const { data, error } = approve
        ? await api.approveAuthorization(authorizationId, opts)
        : await api.denyAuthorization(authorizationId, opts)
      if (error) throw error
      window.location.href = data.redirect_url
    } catch (ex) {
      setErr(ex.message)
      setBusy(false)
    }
  }

  const scopes = (details?.scope || '').split(/\s+/).filter(Boolean)
  const extra = scopes.filter((s) => !READ_SCOPES.includes(s))
  const button = 'flex-1 py-2.5 rounded-xl text-sm disabled:opacity-50'

  return (
    <div className="min-h-screen bg-neutral-200 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-5">
        <h1 className="text-lg font-semibold text-neutral-900">{t('consentTitle')}</h1>

        {!details && !err && <p className="text-sm text-neutral-500">{t('consentLoading')}</p>}
        {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}

        {details && (
          <>
            <p className="text-sm text-neutral-800">
              <strong>{details.client?.name || t('consentUnknownApp')}</strong> {t('consentAsks')}
            </p>
            <ul className="text-sm text-neutral-700 list-disc ps-5 space-y-1">
              <li>{t('consentReadOwn')}</li>
              <li>{t('consentReadShared')}</li>
            </ul>
            {extra.length > 0 && <p className="text-xs text-neutral-500">{t('consentOtherScopes')} {extra.join(', ')}</p>}
            <p className="text-xs text-neutral-500">{t('consentAccount')} {details.user?.email}</p>
            <p className="text-xs text-neutral-500">{t('consentRevoke')}</p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => decide(false)} className={`${button} bg-neutral-100 text-neutral-900`}>{t('consentDeny')}</button>
              <button type="button" disabled={busy} onClick={() => decide(true)} className={`${button} bg-neutral-900 text-white`}>{t('consentAllow')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
