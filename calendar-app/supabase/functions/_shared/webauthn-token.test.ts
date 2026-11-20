import { describe, it, expect } from 'vitest'
import { signToken, readToken, MAX_AGE_MS } from './webauthn-token.ts'

const secret = btoa('0123456789abcdef0123456789abcdef')

describe('webauthn challenge tokens', () => {
  it('round-trips a valid token with its id', async () => {
    const token = await signToken(secret, { c: 'challenge-1', u: 'user-1', k: 'auth' })
    const payload = await readToken(secret, token, 'auth')
    expect(payload.c).toBe('challenge-1')
    expect(payload.u).toBe('user-1')
    expect(payload.j).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('refuses a tampered payload without consuming anything', async () => {
    const token = await signToken(secret, { c: 'challenge-1', u: 'user-1', k: 'auth' })
    const [, sig] = token.split('.')
    const forged = btoa(JSON.stringify({ c: 'attacker', u: 'user-1', k: 'auth', e: Date.now() + 1000, j: crypto.randomUUID() }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    await expect(readToken(secret, `${forged}.${sig}`, 'auth')).rejects.toThrow('bad signature')
  })

  it('refuses a token signed with another secret', async () => {
    const other = btoa('fedcba9876543210fedcba9876543210')
    const token = await signToken(other, { c: 'c', k: 'auth' })
    await expect(readToken(secret, token, 'auth')).rejects.toThrow('bad signature')
  })

  it('refuses a wrong kind, an expired token and a missing id', async () => {
    const token = await signToken(secret, { c: 'c', k: 'auth' })
    await expect(readToken(secret, token, 'stepup')).rejects.toThrow('wrong token kind')
    await expect(readToken(secret, token, 'auth', Date.now() + MAX_AGE_MS + 1)).rejects.toThrow('expired')

    const noId = btoa(JSON.stringify({ c: 'c', k: 'auth', e: Date.now() + 1000 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const body = new TextEncoder().encode(btoa(JSON.stringify({ c: 'c', k: 'auth', e: Date.now() + 1000 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''))
    const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(secret), (ch) => ch.charCodeAt(0)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, body))
    const sigB64 = btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    await expect(readToken(secret, `${noId}.${sigB64}`, 'auth')).rejects.toThrow('bad token id')
  })
})
