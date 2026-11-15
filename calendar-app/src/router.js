import { useEffect, useState } from 'react'

// Minimal hash router: #/terms, #/privacy, #/cookies. Works on static hosting without rewrites.
export const LEGAL_ROUTES = ['terms', 'privacy', 'cookies']

export function useLegalRoute() {
  const read = () => {
    const m = window.location.hash.match(/^#\/(terms|privacy|cookies)$/)
    return m ? m[1] : null
  }
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onHash = () => setRoute(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

export const goLegal = (kind) => { window.location.hash = `/${kind}` }
export const goHome = () => { window.location.hash = '' }
