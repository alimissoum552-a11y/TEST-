import { describe, it, expect } from 'vitest'
import { verifyStripeSignature, verifiedNameOf } from './stripe.ts'

const SECRET = 'whsec_test_secret'
const NOW = 1_800_000_000

async function sign(payload: string, t: number, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('Stripe webhook signature', () => {
  const payload = '{"type":"identity.verification_session.verified"}'

  it('accepts a correctly signed, recent payload', async () => {
    const v1 = await sign(payload, NOW)
    expect(await verifyStripeSignature(payload, `t=${NOW},v1=${v1}`, SECRET, NOW)).toBe(true)
  })

  it('rejects a changed payload', async () => {
    const v1 = await sign(payload, NOW)
    expect(await verifyStripeSignature(payload + ' ', `t=${NOW},v1=${v1}`, SECRET, NOW)).toBe(false)
  })

  it('rejects a wrong secret', async () => {
    const v1 = await sign(payload, NOW, 'other')
    expect(await verifyStripeSignature(payload, `t=${NOW},v1=${v1}`, SECRET, NOW)).toBe(false)
  })

  it('rejects an old timestamp (replay)', async () => {
    const old = NOW - 3600
    const v1 = await sign(payload, old)
    expect(await verifyStripeSignature(payload, `t=${old},v1=${v1}`, SECRET, NOW)).toBe(false)
  })

  it('rejects a missing header or missing secret', async () => {
    expect(await verifyStripeSignature(payload, null, SECRET, NOW)).toBe(false)
    expect(await verifyStripeSignature(payload, `t=${NOW},v1=abc`, '', NOW)).toBe(false)
  })
})

describe('verified name', () => {
  it('builds the name from the verified outputs only', () => {
    expect(verifiedNameOf({ verified_outputs: { first_name: 'Marie', last_name: 'Dupont', dob: {} } })).toBe('Marie Dupont')
  })
  it('returns null when nothing was verified', () => {
    expect(verifiedNameOf({ verified_outputs: {} })).toBeNull()
  })
})
