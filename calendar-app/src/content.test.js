import { describe, it, expect } from 'vitest'
import { LANDING } from './landing.js'
import { PAGES, OPERATOR } from './legal.js'

const LANGS = ['en', 'fr', 'es', 'de', 'ar', 'pt']

describe('landing copy', () => {
  it('has the same keys in every language', () => {
    const base = Object.keys(LANDING.en).sort()
    for (const lang of LANGS) {
      expect(Object.keys(LANDING[lang]).sort(), lang).toEqual(base)
    }
  })

  it('has complete content for the groups panel', () => {
    for (const lang of LANGS) {
      const L = LANDING[lang]
      expect(L.groups, lang).toHaveLength(2)
      for (const k of ['gFamilyEx', 'gSportsEx', 'gClassEx', 'gSteps']) expect(L[k], `${lang} ${k}`).toHaveLength(3)
      for (const k of ['gFamily', 'gSports', 'gClass', 'gVerified', 'gNote']) expect(String(L[k]).length, `${lang} ${k}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('no longer says the AI is read-only', () => {
    expect(LANDING.en.ai[1]).not.toMatch(/read-only/i)
  })
})

describe('legal texts', () => {
  it('numbers the sections without gaps in every language', () => {
    for (const lang of LANGS) {
      for (const kind of ['terms', 'privacy', 'cookies']) {
        const nums = PAGES[lang][kind].map((s) => Number(s.h.split('.')[0]))
        expect(nums, `${lang} ${kind}`).toEqual(nums.map((_, i) => i + 1))
      }
    }
  })

  it('covers well-being, minors and identity verification in privacy and terms', () => {
    for (const lang of LANGS) {
      expect(PAGES[lang].privacy, lang).toHaveLength(16)
      expect(PAGES[lang].terms, lang).toHaveLength(12)
      for (const s of [...PAGES[lang].privacy, ...PAGES[lang].terms]) expect(s.p.length, `${lang} ${s.h}`).toBeGreaterThan(20)
    }
    expect(PAGES.en.privacy[14].p).toMatch(/Stripe/)
    expect(PAGES.en.privacy[13].p).toMatch(/30 days/)
  })

  it('shows the same update date everywhere', () => {
    expect(OPERATOR.updated).toBe('17 November 2026')
    expect(PAGES.en.privacy[15].p).toMatch(/17 November 2026/)
    expect(PAGES.en.cookies[4].p).toMatch(/17 November 2026/)
  })
})

import { PRICING } from './pricing.js'

describe('pricing copy', () => {
  it('has the same keys in every language, for every plan', () => {
    const base = Object.keys(PRICING.en).sort()
    const planKeys = Object.keys(PRICING.en.plans).sort()
    for (const lang of LANGS) {
      expect(Object.keys(PRICING[lang]).sort(), lang).toEqual(base)
      expect(Object.keys(PRICING[lang].plans).sort(), lang).toEqual(planKeys)
      for (const code of planKeys) {
        expect(PRICING[lang].plans[code].items, `${lang} ${code}`).toHaveLength(PRICING.en.plans[code].items.length)
      }
      expect(PRICING[lang].notes, lang).toHaveLength(PRICING.en.notes.length)
    }
  })
  it('tells visitors that nothing is charged yet', () => {
    expect(PRICING.en.banner).toMatch(/No payment is open yet/)
  })
})
