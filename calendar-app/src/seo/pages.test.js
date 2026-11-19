import { describe, it, expect } from 'vitest'
import { SEO_LANGS, renderPage, sitemap, robots, structuredData, esc } from './pages.js'
import { LANDING } from '../landing.js'

describe('static SEO pages', () => {
  it('has a page for every landing language', () => {
    expect(SEO_LANGS.sort()).toEqual(Object.keys(LANDING).sort())
  })

  it('renders each page with its language, canonical, hreflang and real text', () => {
    for (const lang of SEO_LANGS) {
      const html = renderPage(lang)
      const L = LANDING[lang]
      expect(html).toContain(`<html lang="${lang}"`)
      expect(html).toContain(`<link rel="canonical" href="https://collyo.app/${lang}/" />`)
      for (const l of SEO_LANGS) expect(html).toContain(`hreflang="${l}" href="https://collyo.app/${l}/"`)
      expect(html).toContain('hreflang="x-default"')
      expect(html).toContain(`<h1>${esc(L.title)}</h1>`)
      expect(html).toContain(esc(L.faq[0][0]))
      expect(html).toContain('href="/#/signup"')
      expect(html).not.toMatch(/undefined|\[object Object\]/)
    }
    expect(renderPage('ar')).toContain('dir="rtl"')
  })

  it('structured data is valid JSON and cannot close its script tag', () => {
    const blocks = [...structuredData('fr').matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => m[1])
    expect(blocks).toHaveLength(2)
    for (const b of blocks) { expect(b).not.toContain('<'); expect(() => JSON.parse(b)).not.toThrow() }
    expect(JSON.parse(blocks[1]).mainEntity).toHaveLength(LANDING.fr.faq.length)
  })

  it('lists every page in the sitemap and points robots.txt at it', () => {
    const xml = sitemap('2026-11-19')
    expect(xml.match(/<url>/g)).toHaveLength(SEO_LANGS.length + 1)
    for (const l of SEO_LANGS) expect(xml).toContain(`<loc>https://collyo.app/${l}/</loc>`)
    expect(robots()).toContain('Sitemap: https://collyo.app/sitemap.xml')
    expect(robots()).toContain('Disallow: /mcp')
  })
})
