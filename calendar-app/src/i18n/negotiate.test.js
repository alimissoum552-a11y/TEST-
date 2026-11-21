import { describe, it, expect } from 'vitest'
import { negotiateLanguage } from './negotiate.js'

describe('language negotiation', () => {
  it('picks the first supported browser language', () => {
    expect(negotiateLanguage(['pt-BR', 'en-US'])).toBe('pt')
    expect(negotiateLanguage(['fr-CA'])).toBe('fr')
    expect(negotiateLanguage(['ar-EG'])).toBe('ar')
  })
  it('skips unsupported languages and falls back to English', () => {
    expect(negotiateLanguage(['ja-JP', 'de-DE'])).toBe('de')
    expect(negotiateLanguage(['ja-JP', 'ru'])).toBe('en')
    expect(negotiateLanguage([])).toBe('en')
    expect(negotiateLanguage(undefined)).toBe('en')
  })
})
