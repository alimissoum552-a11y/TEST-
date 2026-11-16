import { useEffect, useState } from 'react'
import App from './App.jsx'
import AuthScreen from './AuthScreen.jsx'
import { supabase, supabaseConfigured } from './lib/supabase.js'
import LegalPage from './LegalPage.jsx'
import { useLegalRoute, goBackFromLegal, parseRoute } from './router.js'
import JoinPage from './JoinPage.jsx'

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

  const routeInvite = parseRoute(hash).invite
  const [pending, setPending] = useState(() => routeInvite || readPendingInvite())
  const [joinedCalendarId, setJoinedCalendarId] = useState(null)
  const [session, setSession] = useState(undefined) // undefined = loading

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
  if (session === undefined) return <div className="min-h-screen bg-neutral-200" />
  if (!supabaseConfigured) return <App user={null} />
  if (!session) return <AuthScreen />
  if (pending) {
    return (
      <JoinPage key={pending} inviteId={pending} user={session.user}
        onJoined={setJoinedCalendarId} onDone={finishInvite} />
    )
  }
  return <App user={session.user} initialCalendarId={joinedCalendarId} />
}
