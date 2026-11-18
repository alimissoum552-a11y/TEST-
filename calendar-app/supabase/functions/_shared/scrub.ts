// Removes personal data and secrets from error text before it is stored (pure: no network, testable).
export function scrub(text: unknown, max = 500): string {
  return String(text ?? '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[jwt]')
    .replace(/\b(sk|rk|pk|whsec)_(live|test)?_?[A-Za-z0-9]{8,}/g, '[key]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[number]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [token]')
    .slice(0, max)
}
