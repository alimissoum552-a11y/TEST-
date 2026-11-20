// Signed, expiring challenge tokens for WebAuthn. Pure functions with an injected secret and
// clock, so the negative cases (tampering, expiry, wrong kind, missing id) are unit tested.
export const MAX_AGE_MS = 5 * 60_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

const enc = new TextEncoder()

async function hmacKey(secretB64: string): Promise<CryptoKey> {
  if (!secretB64) throw new Error('missing secret')
  return await crypto.subtle.importKey('raw', fromB64url(secretB64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signToken(
  secretB64: string,
  payload: Record<string, unknown>,
  now = Date.now(),
): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...payload, e: now + MAX_AGE_MS, j: crypto.randomUUID() })))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secretB64), enc.encode(body))
  return `${body}.${b64url(new Uint8Array(sig))}`
}

export async function readToken(
  secretB64: string,
  token: string,
  kind: string,
  now = Date.now(),
): Promise<{ c: string; u?: string; j: string }> {
  const [body, sig] = String(token || '').split('.')
  if (!body || !sig) throw new Error('bad token')
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secretB64), fromB64url(sig), enc.encode(body))
  if (!ok) throw new Error('bad signature')
  const data = JSON.parse(new TextDecoder().decode(fromB64url(body)))
  if (data.k !== kind) throw new Error('wrong token kind')
  if (!data.e || now > data.e) throw new Error('expired')
  if (typeof data.c !== 'string' || !data.c) throw new Error('bad challenge')
  // A token without an id cannot be consumed once: reject it instead of failing later.
  if (typeof data.j !== 'string' || !UUID.test(data.j)) throw new Error('bad token id')
  return { c: data.c, u: data.u, j: data.j }
}
