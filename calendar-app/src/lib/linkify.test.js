import { describe, it, expect } from 'vitest'
import { linkParts, platformLabel } from './linkify.js'

describe('linkify', () => {
  it('splits text and links, trimming trailing punctuation', () => {
    const parts = linkParts('Follow https://x.com/CollyoApp, and https://collyo.app.')
    expect(parts.slice(0, 4).map((p) => p.type)).toEqual(['text', 'link', 'text', 'link'])
    expect(parts[1].value).toBe('https://x.com/CollyoApp')
    expect(parts[3].value).toBe('https://collyo.app')
  })
  it('labels known platforms and falls back to the host', () => {
    expect(platformLabel('https://www.instagram.com/collyo_app/')).toBe('Instagram')
    expect(platformLabel('https://bsky.app/profile/collyoapp.bsky.social')).toBe('Bluesky')
    expect(platformLabel('https://example.org/page')).toBe('example.org')
  })
  it('ignores e-mail addresses and non-https text', () => {
    expect(linkParts('mail adam@example.com').every((p) => p.type === 'text')).toBe(true)
    expect(linkParts('http://insecure.test').every((p) => p.type === 'text')).toBe(true)
  })
})
