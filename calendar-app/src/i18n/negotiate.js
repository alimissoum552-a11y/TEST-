// Language negotiation for a first visit: the browser's preferred languages decide, in order,
// among the languages the app supports. Anything unknown falls back to English.
export const SUPPORTED = ['en', 'fr', 'es', 'de', 'ar', 'pt']

export function negotiateLanguage(preferred) {
  const list = Array.isArray(preferred) ? preferred : preferred ? [preferred] : []
  for (const tag of list) {
    const base = String(tag || '').toLowerCase().split('-')[0]
    if (SUPPORTED.includes(base)) return base
  }
  return 'en'
}
