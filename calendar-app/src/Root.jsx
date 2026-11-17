import { useEffect, useState } from 'react'
import App from './App.jsx'
import AuthScreen from './AuthScreen.jsx'
import { supabase, supabaseConfigured } from './lib/supabase.js'
import LegalPage from './LegalPage.jsx'
import { useLegalRoute, goBackFromLegal, parseRoute } from './router.js'
import JoinPage from './JoinPage.jsx'
import AiGuidePage from './AiGuidePage.jsx'
import OAuthConsentPage from './OAuthConsentPage.jsx'
import Landing from './Landing.jsx'
import ResetPasswordPage from './ResetPasswordPage.jsx'
import ConsentPage from './ConsentPage.jsx'
import MinorLogin from './MinorLogin.jsx'
import { getMyProfile } from './lib/api.js'
import { useI18n } from './i18n/index.jsx'
import { listPasskeys, verifyWithPasskey, isPasskeyVerified, markPasskeyVerified, clearPasskeyVerifications } from './passkeys.js'

// A pending invitation is kept in this browser until it is answered or dismissed.
// That way it survives sign-out, sign-in, and the e-mail confirmation step of a new account.
const PENDING_KEY = 'calendar-app.pendingInvite'
const readPendingInvite = () => {
  try { return localStorage.getItem(PENDING_KEY) } catch { return null }
}
const savePendingInvite = (id) => {
  try { if (id) localStorage.setItem(PENDING_KEY, id); else localStorage.removeItem(PENDING_KEY) } catch { /* storage unavailable */ }
}

export default function Root() {
  const legal = useLegalRoute()
  const [hash, setHash] = useState(window.location.hash)
  const [recovery, setRecovery] = useState(() => /[#&?]type=recovery/.test(window.location.hash))
  // Supabase puts error_code=otp_expired in the address when a link is expired or already used.
  const [linkExpired] = useState(() => /[#&?]error_code=/.test(window.location.hash))
  useEffect(() => {
    const f = () => {
      setHash(window.location.hash)
      if (/[#&?]type=recovery/.test(window.location.hash)) setRecovery(true)
    }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  const { invite: routeInvite, consent, auth, guide, reset, consentToken, minor } = parseRoute(hash)
  const [pending, setPending] = useState(() => routeInvite || readPendingInvite())
  const [joinedCalendarId, setJoinedCalendarId] = useState(null)
  const [session, setSession] = useState(undefined) // undefined = loading
  // loading: the passkey list is not known yet (nothing is shown); checking: a passkey must be confirmed; ok: open.
  const [passkeyGate, setPasskeyGate] = useState('loading') // loading | checking | ok
  const [authError, setAuthError] = useState(null)
  // adult | minor | loading. A minor account opens a reduced app (calendar in read-only mode and the team chat).
  const [accountType, setAccountType] = useState('loading')
  useEffect(() => {
    if (!session) { setAccountType('loading'); return }
    getMyProfile(session.user.id).then((p) => setAccountType(p?.account_type === 'minor' ? 'minor' : 'adult')).catch(() => setAccountType('adult'))
  }, [session])

  // A passkey account must confirm with the device before the calendar opens.
  // No extra screen: the device shows its own prompt; meanwhile the app stays blank.
  useEffect(() => {
    if (!session) { clearPasskeyVerifications(); setPasskeyGate('loading'); return }
    if (isPasskeyVerified(session.user.id)) { setPasskeyGate('ok'); return }
    // After an e-mail recovery the user may have lost the device: the reset page comes first and can remove the passkeys.
    if (recovery) { setPasskeyGate('ok'); return }
    let cancelled = false
    ;(async () => {
      try {
        const keys = await listPasskeys(session.user.id)
        if (cancelled) return
        if (!keys.length) { setPasskeyGate('ok'); return }
        // Only now is the device needed: the waiting screen appears only for accounts that have a passkey.
        setPasskeyGate('checking')
        await verifyWithPasskey()
        if (cancelled) return
        markPasskeyVerified(session.user.id)
        setAuthError(null)
        setPasskeyGate('ok')
      } catch (ex) {
        if (cancelled) return
        setAuthError(ex?.name === 'NotAllowedError' ? 'passkeyCancelled' : 'passkeyFailed')
        await supabase.auth.signOut()
        setPasskeyGate('loading')
      }
    })()
    return () => { cancelled = true }
  }, [session, recovery])
  useEffect(() => {
    if (routeInvite) { savePendingInvite(routeInvite); setPending(routeInvite) }
  }, [routeInvite])

  useEffect(() => {
    if (!supabaseConfigured) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    // The client emits PASSWORD_RECOVERY when it handles a reset link, whatever the timing of the page load.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Leaves the invitation page: optionally selects the calendar just joined.
  function finishInvite(calendarId) {
    savePendingInvite(null)
    setPending(null)
    if (calendarId) setJoinedCalendarId(calendarId)
    window.location.hash = ''
  }

  if (legal) return <LegalPage kind={legal} onBack={goBackFromLegal} />
  if (guide) return <AiGuidePage onBack={() => { window.location.hash = '' }} />
  // The guardian consent page needs no sign-in.
  if (consentToken) return <ConsentPage token={consentToken} />
  if (session === undefined) return <div className="min-h-screen bg-neutral-200" />
  if (!supabaseConfigured) return <App user={null} />
  // Visitors who are not signed in see the landing page at the root; sign-in and sign-up routes open the form.
  if (!session && linkExpired) return <AuthScreen initialError="resetLinkExpired" />
  if (!session && minor) return <MinorLogin />
  if (!session) return (routeInvite || consent || auth) ? <AuthScreen initialError={authError} /> : <Landing />
  if (consent) return <OAuthConsentPage key={consent} authorizationId={consent} />
  if (pending) {
    return (
      <JoinPage key={pending} inviteId={pending} user={session.user}
        onJoined={setJoinedCalendarId} onDone={finishInvite} />
    )
  }
  if ((reset || recovery) && session) return <ResetPasswordPage byEmail={recovery} />
  if (passkeyGate === 'loading') return <div className="min-h-screen bg-neutral-200" />
  if (passkeyGate === 'checking') return <PasskeyWaiting />
  if (accountType === 'loading') return <div className="min-h-screen bg-neutral-200" />
  return <App user={session.user} initialCalendarId={joinedCalendarId} minorMode={accountType === 'minor'} />
}

// Shown while the device is asking for its unlock, instead of a blank page.
function PasskeyWaiting() {
  const { t } = useI18n()
  return (
    <div className="min-h-screen bg-neutral-200 flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className="mx-auto h-10 w-10 text-neutral-900 motion-safe:animate-pulse" aria-hidden="true">
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V8a4 4 0 0 1 7.5-2" />
        </svg>
        <p className="text-sm text-neutral-600">{t('passkeyWaiting')}</p>
      </div>
    </div>
  )
}
