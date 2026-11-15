import { useEffect, useState } from 'react'
import App from './App.jsx'
import AuthScreen from './AuthScreen.jsx'
import { supabase, supabaseConfigured } from './lib/supabase.js'
import LegalPage from './LegalPage.jsx'
import { useLegalRoute, goBackFromLegal, parseRoute } from './router.js'
import JoinPage from './JoinPage.jsx'

export default function Root() {
  const legal = useLegalRoute()
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const f = () => setHash(window.location.hash)
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const inviteId = parseRoute(hash).invite
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    if (!supabaseConfigured) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (legal) return <LegalPage kind={legal} onBack={goBackFromLegal} />
  if (inviteId && session) return <JoinPage inviteId={inviteId} />
  if (session === undefined) return <div className="min-h-screen bg-neutral-200" />
  if (!supabaseConfigured) return <App user={null} />
  if (!session) return <AuthScreen />
  return <App user={session.user} />
}
