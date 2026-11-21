import { describe, it, expect } from 'vitest'
import { SEO_LANGS, renderPricing, renderSignup, sitemap, pricingUrl, signupUrl } from './pages.js'
import { PRICING } from '../pricing.js'
import { LANDING } from '../landing.js'

describe('pricing and signup routes', () => {
  for (const lang of SEO_LANGS) {
    it(`${lang}: pricing page is complete`, () => {
      const html = renderPricing(lang)
      expect(html).toContain(`<html lang="${lang}"`)
      expect(html).toContain(`<link rel="canonical" href="${pricingUrl(lang)}" />`)
      expect(html).toContain(PRICING[lang].title)
      for (const plan of Object.values(PRICING[lang].plans)) expect(html).toContain(plan.name)
      for (const l of SEO_LANGS) expect(html).toContain(`hreflang="${l}" href="${pricingUrl(l)}"`)
      expect(html).toContain('og:title')
      expect(html).toContain(signupUrl(lang))
    })

    it(`${lang}: signup page is complete`, () => {
      const html = renderSignup(lang)
      expect(html).toContain(`<html lang="${lang}"`)
      expect(html).toContain(`<link rel="canonical" href="${signupUrl(lang)}" />`)
      expect(html).toContain(LANDING[lang].signup)
      expect(html).toContain('href="/#/signup"')
      for (const l of SEO_LANGS) expect(html).toContain(`hreflang="${l}" href="${signupUrl(l)}"`)
      expect(html).toContain(pricingUrl(lang))
    })
  }

  it('sitemap lists every route with alternates', () => {
    const xml = sitemap('2026-11-21')
    for (const lang of SEO_LANGS) {
      expect(xml).toContain(`<loc>${pricingUrl(lang)}</loc>`)
      expect(xml).toContain(`<loc>${signupUrl(lang)}</loc>`)
    }
  })

  it('does not claim paid prices', () => {
    for (const lang of SEO_LANGS) {
      const html = renderPricing(lang)
      expect(html).not.toMatch(/"price"\s*:\s*"(1|2|3|4|5|6|7|8|9)/)
    }
  })
})
