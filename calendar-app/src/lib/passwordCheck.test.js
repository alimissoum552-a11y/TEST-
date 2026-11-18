import { describe, it, expect } from 'vitest'
import { sha1Hex, isPwned, passwordProblem } from './passwordCheck.js'

describe('password check', () => {
  it('hashes with SHA-1 in upper-case hex', async () => {
    expect(await sha1Hex('password')).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8')
  })
  it('sends only the first 5 characters of the hash and finds the suffix in the answer', async () => {
    let asked = ''
    const fetchImpl = async (url) => { asked = url; return { ok: true, text: async () => '00000000000000000000000000000000000:0\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\r\n' } }
    expect(await isPwned('password', fetchImpl)).toBe(true)
    expect(asked).toBe('https://api.pwnedpasswords.com/range/5BAA6')
    expect(asked.split('/range/')[1]).toHaveLength(5)
  })
  it('ignores padding lines with a zero count and fails open', async () => {
    const zero = async () => ({ ok: true, text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:0' })
    expect(await isPwned('password', zero)).toBe(false)
    expect(await isPwned('password', async () => { throw new Error('offline') })).toBe(false)
    expect(await isPwned('password', async () => ({ ok: false }))).toBe(false)
  })
  it('asks for 10 characters first, then refuses a leaked password', async () => {
    const leaked = async () => ({ ok: true, text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:5' })
    expect(await passwordProblem('short', leaked)).toBe('passwordTooShort')
    expect(await passwordProblem('a-long-and-unusual-one', async () => ({ ok: true, text: async () => '' }))).toBeNull()
  })
})
