import { useEffect, useState } from 'react'

// Minimal hash router: #/terms, #/privacy, #/cookies. Works on static hosting without rewrites.
export const LEGAL_ROUTES = ['terms', 'privacy', 'cookies']

// Parses the hash. Returns { legal, auth } where auth is 'signin' | 'signup' | null.
export function parseRoute(hash) {
  const legal = hash.match(/^#\/(terms|privacy|cookies)(?:\?from=(?:signin|signup|landing))?$/)?.[1] ?? null
  const auth = hash.match(/^#\/(signin|signup)$/)?.[1] ?? null
  const invite = hash.match(/^#\/join\?invite=([0-9a-f-]{36})$/i)?.[1] ?? null
  const consent = hash.match(/^#\/oauth\/consent\?authorization_id=([^&]+)/)?.[1] ?? null
  const guide = /#\/ai-guide$/.test(hash)
  const reset = /#\/reset-password$/.test(hash)
  return { legal, auth, invite, consent, guide, reset }
}

export function useLegalRoute() {
  const read = () => parseRoute(window.location.hash).legal
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onHash = () => setRoute(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

// Opening a legal page remembers where the user came from (sign in or sign up)
// so the back button returns to the same form.
export const goLegal = (kind, from = 'signin') => { window.location.hash = `/${kind}?from=${from}` }
export const goBackFromLegal = () => {
  const target = legalReturnTarget(window.location.hash)
  window.location.hash = target === 'landing' ? '' : target === 'signup' ? '/signup' : '/signin'
}
export const goHome = () => { window.location.hash = '' }

// Where the legal page's back button should go, read from the hash.
export function legalReturnTarget(hash) {
  return hash.match(/\?from=(signin|signup|landing)/)?.[1] ?? 'signin'
}
