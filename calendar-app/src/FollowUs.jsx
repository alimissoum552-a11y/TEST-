import { useState } from 'react'
import { SOCIAL_LINKS } from './SocialLinks.jsx'

// The accounts are plain text links, in the same style as the footer links (no button, no chip).
// "Follow us" is itself a plain text trigger: the links spread out horizontally, one after another.
const linkClass = 'hover:text-neutral-900 underline-offset-2 hover:underline'

export default function FollowUs({ label = 'Follow us' }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-xs text-neutral-500">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={linkClass}>
        {label}
      </button>
      <ul className={`flex flex-wrap gap-x-4 gap-y-2 overflow-hidden transition-all duration-500 ease-out ${open ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}
        aria-hidden={!open}>
        {SOCIAL_LINKS.map((s, i) => (
          <li key={s.id}
            className={`transition-all duration-500 ease-out ${open ? 'translate-x-0 opacity-100' : '-translate-x-3 opacity-0'}`}
            style={{ transitionDelay: `${open ? i * 45 : 0}ms` }}>
            <a href={s.href} target="_blank" rel="noopener noreferrer me" data-social-link={s.id}
              tabIndex={open ? 0 : -1} className={linkClass}>{s.name}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
