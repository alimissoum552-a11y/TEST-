import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import SocialLinks, { SOCIAL_LINKS } from './SocialLinks.jsx'
import { LANDING } from './landing.js'

describe('social links', () => {
  it('starts closed: one button, the list hidden', () => {
    const html = renderToString(<SocialLinks label="Follow Collyo" />)
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Follow Collyo"')
    expect(html).toMatch(/<ul[^>]*hidden=""/)
  })

  it('lists every account, opening in a new tab without passing the opener', () => {
    const html = renderToString(<SocialLinks label="Follow" defaultOpen />)
    expect(html).toContain('aria-expanded="true"')
    for (const s of SOCIAL_LINKS) {
      expect(html).toContain(`href="${s.href}"`)
      expect(s.href.startsWith('https://')).toBe(true)
    }
    expect(html.match(/rel="noopener noreferrer me"/g)).toHaveLength(SOCIAL_LINKS.length)
  })

  it('has a label in every landing language', () => {
    for (const [lang, L] of Object.entries(LANDING)) expect(L.follow, lang).toBeTruthy()
  })
})
