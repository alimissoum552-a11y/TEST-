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
  useEffect(() => {
    const f = () => setHash(window.location.hash)
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  const { invite: routeInvite, consent, auth, guide } = parseRoute(hash)
  const [pending, setPending] = useState(() => routeInvite || readPendingInvite())
  const [joinedCalendarId, setJoinedCalendarId] = useState(null)
  const [session, setSession] = useState(undefined) // undefined = loading
  const [passkeyGate, setPasskeyGate] = useState('idle') // idle | checking | ok
  const [authError, setAuthError] = useState(null)

  // A passkey account must confirm with the device before the calendar opens.
  // No extra screen: the device shows its own prompt; meanwhile the app stays blank.
  useEffect(() => {
    if (!session) { clearPasskeyVerifications(); setPasskeyGate('idle'); return }
    if (isPasskeyVerified(session.user.id)) { setPasskeyGate('ok'); return }
    let cancelled = false
    setPasskeyGate('checking')
    ;(async () => {
      try {
        const keys = await listPasskeys(session.user.id)
        if (!keys.length) { if (!cancelled) setPasskeyGate('ok'); return }
        await verifyWithPasskey()
        if (cancelled) return
        markPasskeyVerified(session.user.id)
        setAuthError(null)
        setPasskeyGate('ok')
      } catch (ex) {
        if (cancelled) return
        setAuthError(ex?.name === 'NotAllowedError' ? 'passkeyCancelled' : 'passkeyFailed')
        await supabase.auth.signOut()
        setPasskeyGate('idle')
      }
    })()
    return () => { cancelled = true }
  }, [session])
  useEffect(() => {
    if (routeInvite) { savePendingInvite(routeInvite); setPending(routeInvite) }
  }, [routeInvite])

  useEffect(() => {
    if (!supabaseConfigured) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
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
  if (session === undefined) return <div className="min-h-screen bg-neutral-200" />
  if (!supabaseConfigured) return <App user={null} />
  // Visitors who are not signed in see the landing page at the root; sign-in and sign-up routes open the form.
  if (!session) return (routeInvite || consent || auth) ? <AuthScreen initialError={authError} /> : <Landing />
  if (consent) return <OAuthConsentPage key={consent} authorizationId={consent} />
  if (pending) {
    return (
      <JoinPage key={pending} inviteId={pending} user={session.user}
        onJoined={setJoinedCalendarId} onDone={finishInvite} />
    )
  }
  if (passkeyGate === 'checking') return <div className="min-h-screen bg-neutral-200" />
  return <App user={session.user} initialCalendarId={joinedCalendarId} />
}
