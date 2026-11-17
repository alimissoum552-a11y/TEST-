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
import LockScreen from './LockScreen.jsx'
import { isLockEnabled } from './lock.js'

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
  const [lockOn, setLockOn] = useState(() => isLockEnabled())
  const [locked, setLocked] = useState(() => isLockEnabled())

  // Auto-lock after 10 minutes without interaction, only when the passcode is on.
  useEffect(() => {
    if (!session || !lockOn || locked) return
    let timer
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setLocked(true), 10 * 60_000)
    }
    reset()
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [session, lockOn, locked])

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
  if (!session) return (routeInvite || consent || auth) ? <AuthScreen /> : <Landing />
  if (consent) return <OAuthConsentPage key={consent} authorizationId={consent} />
  if (pending) {
    return (
      <JoinPage key={pending} inviteId={pending} user={session.user}
        onJoined={setJoinedCalendarId} onDone={finishInvite} />
    )
  }
  if (lockOn && locked) return <LockScreen onUnlock={() => setLocked(false)} />
  return (
    <App user={session.user} initialCalendarId={joinedCalendarId}
      lockOn={lockOn} onLockChanged={(v) => { setLockOn(v); setLocked(false) }} onLockNow={() => setLocked(true)} />
  )
}
