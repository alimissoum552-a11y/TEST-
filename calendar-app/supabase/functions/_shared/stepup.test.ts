import { describe, it, expect } from 'vitest'
import { sessionIdFromToken, bearerToken } from './stepup.ts'

const encode = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const token = (payload: unknown) => `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`

describe('session id extraction', () => {
  it('returns the session_id claim', () => {
    expect(sessionIdFromToken(token({ sub: 'u1', session_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })))
      .toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  })

  it('never falls back to sub or user_id', () => {
    expect(sessionIdFromToken(token({ sub: 'u1', user_id: 'u2' }))).toBeNull()
  })

  it('refuses an empty, non-string or missing claim', () => {
    expect(sessionIdFromToken(token({ session_id: '' }))).toBeNull()
    expect(sessionIdFromToken(token({ session_id: 42 }))).toBeNull()
    expect(sessionIdFromToken(token({ sub: 'u1' }))).toBeNull()
  })

  it('refuses a malformed token', () => {
    expect(sessionIdFromToken('')).toBeNull()
    expect(sessionIdFromToken('not-a-jwt')).toBeNull()
    expect(sessionIdFromToken('a.%%%.c')).toBeNull()
  })

  it('reads the bearer token from the header only', () => {
    const req = new Request('https://x', { headers: { Authorization: 'Bearer abc.def.ghi' } })
    expect(bearerToken(req)).toBe('abc.def.ghi')
    expect(bearerToken(new Request('https://x'))).toBeNull()
    expect(bearerToken(new Request('https://x', { headers: { Authorization: 'Basic x' } }))).toBe('Basic x')
  })
})
