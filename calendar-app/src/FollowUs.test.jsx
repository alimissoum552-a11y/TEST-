import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import FollowUs from './FollowUs.jsx'
import { SOCIAL_LINKS } from './SocialLinks.jsx'

// HTML escapes '&' in attributes.
const escHref = (u) => u.replace(/&/g, '&amp;')

describe('follow us button', () => {
  const html = renderToString(<FollowUs />)
  it('shows the button with the requested label', () => {
    expect(html).toContain('Follow us')
    expect(html).toContain('aria-expanded="false"')
  })
  it('contains every account, opening in a new tab', () => {
    for (const s of SOCIAL_LINKS) {
      expect(html).toContain(`href="${escHref(s.href)}"`)
      expect(html).toContain(`data-social-link="${s.id}"`)
    }
  })
  it('includes Snapchat and LinkedIn', () => {
    expect(html).toContain('snapchat.com/add/collyo_app')
    expect(html).toContain('linkedin.com/company/collyo')
  })
})
