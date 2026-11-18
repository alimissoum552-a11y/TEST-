// Collyo's public social accounts. Order = order shown.
export const SOCIAL_LINKS = [
  { id: 'instagram', name: 'Instagram', href: 'https://www.instagram.com/collyo_app' },
  { id: 'facebook', name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61596911061284' },
  { id: 'tiktok', name: 'TikTok', href: 'https://www.tiktok.com/@collyo_app' },
  { id: 'x', name: 'X', href: 'https://x.com/CollyoApp' },
  { id: 'threads', name: 'Threads', href: 'https://www.threads.net/@collyo_app' },
  { id: 'bluesky', name: 'Bluesky', href: 'https://bsky.app/profile/collyoapp.bsky.social' },
  { id: 'substack', name: 'Substack', href: 'https://substack.com/@collyo1' },
]

// The account names, in the same small grey text as the footer, scrolling slowly from right to left
// across the full width of the page. The row is repeated so the loop has no gap; the copy is hidden
// from screen readers and keyboard. Hovering or focusing a link pauses it; with reduced motion the
// names simply sit centred and still (see .social-marquee in index.css).
export default function SocialLinks({ label, links = SOCIAL_LINKS }) {
  const row = (copy) => (
    <ul className="social-marquee-row flex shrink-0 items-center gap-10 pr-10" aria-hidden={copy || undefined}>
      {links.map((s) => (
        <li key={s.id} className="shrink-0">
          <a href={s.href} target="_blank" rel="noopener noreferrer me" tabIndex={copy ? -1 : undefined}
            data-social-link={copy ? undefined : s.id}
            className="whitespace-nowrap hover:text-neutral-900 focus-visible:text-neutral-900">{s.name}</a>
        </li>
      ))}
    </ul>
  )
  return (
    <nav aria-label={label} className="social-marquee w-full overflow-hidden py-4 text-xs text-neutral-500" data-social>
      <div className="social-marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </nav>
  )
}
