import { describe, it, expect } from 'vitest'
import {
  generateAccessId, formatAccessId, normalizeAccessId, isValidAccessIdShape, hmacHex, tooManyAttempts,
  consentRequired, validEmail, ID_LENGTH,
} from './access.ts'

describe('access identifier', () => {
  it('has 12 characters from the readable alphabet', () => {
    const id = generateAccessId()
    expect(id).toHaveLength(ID_LENGTH)
    expect(isValidAccessIdShape(id)).toBe(true)
    expect(id).not.toMatch(/[ILOU]/)
  })

  it('is different each time', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateAccessId()))
    expect(ids.size).toBe(200)
  })

  it('uses every byte value without bias', () => {
    // 256 values map onto 32 symbols exactly 8 times each.
    const counts = new Map<string, number>()
    for (let b = 0; b < 256; b++) {
      const id = generateAccessId(new Uint8Array(ID_LENGTH).fill(b))
      counts.set(id[0], (counts.get(id[0]) ?? 0) + 1)
    }
    expect(counts.size).toBe(32)
    expect(new Set(counts.values())).toEqual(new Set([8]))
  })

  it('is shown in groups of four and typed back in any form', () => {
    const id = 'ABCD1234EFGH'
    expect(formatAccessId(id)).toBe('ABCD-1234-EFGH')
    expect(normalizeAccessId(' abcd-1234 efgh ')).toBe(id)
    expect(normalizeAccessId('abcd-l234-efgh')).toBe('ABCD1234EFGH') // l read as 1
    expect(normalizeAccessId('abcd-0234-efgh')).toBe(normalizeAccessId('abcd-O234-efgh')) // o read as 0
  })

  it('rejects an identifier of the wrong shape', () => {
    expect(isValidAccessIdShape('SHORT')).toBe(false)
    expect(isValidAccessIdShape('ABCD1234EFG!')).toBe(false)
  })
})

describe('hash', () => {
  it('is stable for the same value and secret, different otherwise', async () => {
    const a = await hmacHex('ABCD1234EFGH', 'secret-1')
    expect(a).toBe(await hmacHex('ABCD1234EFGH', 'secret-1'))
    expect(a).not.toBe(await hmacHex('ABCD1234EFGH', 'secret-2'))
    expect(a).not.toBe(await hmacHex('ABCD1234EFGJ', 'secret-1'))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('login attempts', () => {
  it('blocks after 5 failures for one identifier or 20 for one address', () => {
    expect(tooManyAttempts(4, 19)).toBe(false)
    expect(tooManyAttempts(5, 0)).toBe(true)
    expect(tooManyAttempts(0, 20)).toBe(true)
  })
})

describe('consent rule', () => {
  const now = new Date('2026-11-17T12:00:00Z')
  it('is required when the child may be under 13 (year difference of 13 or less)', () => {
    expect(consentRequired(2026 - 9, now)).toBe(true)
    expect(consentRequired(2026 - 13, now)).toBe(true) // age 12 or 13: unknown, so consent
    expect(consentRequired(2026 - 14, now)).toBe(false) // at least 13
  })
})

describe('guardian e-mail', () => {
  it('accepts an address and rejects nonsense', () => {
    expect(validEmail('parent@example.com')).toBe(true)
    expect(validEmail('not an email')).toBe(false)
    expect(validEmail(42)).toBe(false)
  })
})

describe('masked e-mail', () => {
  it('keeps the first letter and the domain only', async () => {
    const { maskEmail } = await import('./access.ts')
    expect(maskEmail('said.zeghidi@gmail.com')).toBe('s***@gmail.com')
    expect(maskEmail('not-an-email')).toBe('')
  })
})
