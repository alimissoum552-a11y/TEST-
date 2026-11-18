import { describe, it, expect } from 'vitest'
import { scrub } from './scrub.ts'

describe('scrub', () => {
  it('removes e-mail addresses, tokens, keys and card numbers', () => {
    const out = scrub('user a.b+c@example.com failed with Bearer abc.def and key sk_live_51Habcdefghij, card 4242 4242 4242 4242, jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig')
    expect(out).not.toMatch(/example\.com|4242 4242|sk_live_51H|abc\.def|eyJhbGci/)
    expect(out).toContain('[email]')
    expect(out).toContain('[key]')
    expect(out).toContain('[number]')
    expect(out).toContain('Bearer [token]')
  })
  it('keeps ordinary messages and cuts long ones', () => {
    expect(scrub('relation "events" does not exist')).toBe('relation "events" does not exist')
    expect(scrub('x'.repeat(900))).toHaveLength(500)
    expect(scrub(undefined)).toBe('')
  })
})
