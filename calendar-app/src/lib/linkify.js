// Splits a chat message into text and https links, with a short label per platform.
const PLATFORMS = [
  ['collyo.app', 'Collyo'], ['x.com', 'X'], ['instagram.com', 'Instagram'], ['tiktok.com', 'TikTok'],
  ['youtube.com', 'YouTube'], ['facebook.com', 'Facebook'], ['linkedin.com', 'LinkedIn'],
  ['threads.com', 'Threads'], ['bsky.app', 'Bluesky'], ['snapchat.com', 'Snapchat'],
  ['substack.com', 'Substack'], ['reddit.com', 'Reddit'], ['indiehackers.com', 'Indie Hackers'],
]

export function platformLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    const found = PLATFORMS.find(([domain]) => host === domain || host.endsWith('.' + domain))
    return found ? found[1] : host
  } catch {
    return url
  }
}

export function linkParts(text) {
  const source = String(text || '')
  const out = []
  const re = /https:\/\/[^\s<>()]+/g
  let last = 0
  let m
  while ((m = re.exec(source))) {
    const raw = m[0]
    const url = raw.replace(/[.,;:!?]+$/, '')
    if (m.index > last) out.push({ type: 'text', value: source.slice(last, m.index) })
    out.push({ type: 'link', value: url, label: platformLabel(url) })
    last = m.index + url.length
    re.lastIndex = last
  }
  if (last < source.length) out.push({ type: 'text', value: source.slice(last) })
  return out
}
