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

// One row of account names in the footer text style. Each account appears once.
export default function SocialLinks({ label, links = SOCIAL_LINKS }) {
  return (
    <nav aria-label={label} data-social className="w-full px-6 py-4 text-xs text-neutral-500">
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {links.map((s) => (
          <li key={s.id} className="shrink-0">
            <a href={s.href} target="_blank" rel="noopener noreferrer me" data-social-link={s.id}
              className="whitespace-nowrap hover:text-neutral-900 focus-visible:text-neutral-900">{s.name}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
