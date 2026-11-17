// Stripe webhook signature check (Stripe-Signature header: t=<unix>,v1=<hex HMAC-SHA256 of "t.payload">).
// Pure: no network, so it can be tested. Rejects anything older than the tolerance (replay protection).
export const TOLERANCE_SECONDS = 300

export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header || !secret) return false
  const parts = Object.fromEntries(header.split(',').map((p) => {
    const i = p.indexOf('=')
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()]
  }))
  const t = Number(parts['t'])
  const v1 = String(parts['v1'] ?? '')
  if (!Number.isFinite(t) || !v1) return false
  if (Math.abs(nowSeconds - t) > TOLERANCE_SECONDS) return false

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`))
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return constantTimeEquals(expected, v1)
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Name as Stripe returns it for a verified document. Only the name is kept.
export function verifiedNameOf(session: any): string | null {
  const first = String(session?.verified_outputs?.first_name ?? '').trim()
  const last = String(session?.verified_outputs?.last_name ?? '').trim()
  const name = `${first} ${last}`.trim()
  return name || null
}
