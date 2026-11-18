import { useEffect, useId, useRef, useState } from 'react'

// Collyo's public social accounts (docs/GROWTH.md). Order = order shown.
// `icon` is optional: put the platform's official icon file (from its brand resources) in public/icons/social/
// and set its path here. Without it, the platform name is shown as text.
export const SOCIAL_LINKS = [
  { id: 'instagram', name: 'Instagram', href: 'https://www.instagram.com/collyo_app', icon: null },
  { id: 'facebook', name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61596911061284', icon: null },
  { id: 'tiktok', name: 'TikTok', href: 'https://www.tiktok.com/@collyo_app', icon: null },
  { id: 'x', name: 'X', href: 'https://x.com/CollyoApp', icon: null },
  { id: 'threads', name: 'Threads', href: 'https://www.threads.net/@collyo_app', icon: null },
  { id: 'bluesky', name: 'Bluesky', href: 'https://bsky.app/profile/collyoapp.bsky.social', icon: null },
  { id: 'substack', name: 'Substack', href: 'https://substack.com/@collyo1', icon: null },
]

// One button with a generic "network" icon. Tapping it slides the list of accounts open horizontally;
// tapping again, pressing Escape or clicking elsewhere closes it.
export default function SocialLinks({ label, links = SOCIAL_LINKS, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const rootRef = useRef(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="flex items-center gap-2" data-social>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={listId} aria-label={label} title={label}
        className={`shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-full ring-1 transition-colors ${open ? 'bg-neutral-900 text-white ring-neutral-900' : 'bg-white text-neutral-700 ring-neutral-300 hover:text-neutral-900'}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="M8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5" />
        </svg>
      </button>
      <ul id={listId} aria-label={label} hidden={!open}
        className="flex items-center gap-2 overflow-x-auto max-w-[70vw] motion-safe:animate-[socialIn_200ms_ease-out]">
        {links.map((s) => (
          <li key={s.id} className="shrink-0">
            <a href={s.href} target="_blank" rel="noopener noreferrer me" data-social-link={s.id} aria-label={s.name} title={s.name}
              className="h-9 min-w-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-white ring-1 ring-neutral-300 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:ring-neutral-500">
              {s.icon ? <img src={s.icon} alt="" width="16" height="16" className="h-4 w-4" /> : <span>{s.name}</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
