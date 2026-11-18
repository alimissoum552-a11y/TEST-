import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import SocialLinks, { SOCIAL_LINKS } from './SocialLinks.jsx'
import { LANDING } from './landing.js'

describe('social links', () => {
  const html = renderToString(<SocialLinks label="Follow Collyo" />)

  it('is a labelled navigation in the footer text style', () => {
    expect(html).toMatch(/<nav[^>]*aria-label="Follow Collyo"/)
    expect(html).toContain('text-xs text-neutral-500')
  })

  it('links every account once for assistive tech, opening in a new tab', () => {
    for (const s of SOCIAL_LINKS) {
      expect(s.href.startsWith('https://')).toBe(true)
      expect(html.split(`href="${s.href}"`)).toHaveLength(3) // visible row + hidden loop copy
      expect(html.match(new RegExp(`data-social-link="${s.id}"`, 'g'))).toHaveLength(1)
    }
    expect(html.match(/rel="noopener noreferrer me"/g)).toHaveLength(SOCIAL_LINKS.length * 2)
    expect(html).toContain('aria-hidden="true"')
    expect(html.match(/tabindex="-1"/gi)).toHaveLength(SOCIAL_LINKS.length)
  })

  it('has a label in every landing language', () => {
    for (const [lang, L] of Object.entries(LANDING)) expect(L.follow, lang).toBeTruthy()
  })
})
