import { describe, it, expect } from 'vitest'
import { minorAiAllows } from './ai-guard.ts'

describe('minorAiAllows', () => {
  it('allows only an explicit true without an error', () => {
    expect(minorAiAllows(true, null)).toBe(true)
  })

  it('refuses false, null, undefined and any error (fail-closed)', () => {
    expect(minorAiAllows(false, null)).toBe(false)
    expect(minorAiAllows(null, null)).toBe(false)
    expect(minorAiAllows(undefined, null)).toBe(false)
    expect(minorAiAllows(null, { message: 'permission denied' })).toBe(false)
    expect(minorAiAllows(true, { message: 'timeout' })).toBe(false)
  })
})
