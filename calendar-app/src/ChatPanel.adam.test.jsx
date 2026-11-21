import { describe, it, expect } from 'vitest'
import { MENTION } from './ChatPanel.jsx'

describe('Adam mentions', () => {
  it('recognises @Adam and the legacy triggers', () => {
    expect(MENTION.test('@Adam what is planned?')).toBe(true)
    expect(MENTION.test('@AI what is planned?')).toBe(true)
    expect(MENTION.test('@IA et demain ?')).toBe(true)
    expect(MENTION.test('hello @adam.')).toBe(true)
  })
  it('does not react to plain text or an e-mail address', () => {
    expect(MENTION.test('hello team')).toBe(false)
    expect(MENTION.test('mail me at adam@example.com')).toBe(false)
  })
})
