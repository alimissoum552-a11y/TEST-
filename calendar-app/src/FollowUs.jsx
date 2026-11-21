import { useState } from 'react'
import { SOCIAL_LINKS } from './SocialLinks.jsx'

// One button, then the accounts spread out horizontally, one after another.
export default function FollowUs({ label = 'Follow us' }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="px-6 md:px-10 pb-14 max-w-6xl mx-auto">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900">
        {label}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <ul className={`mt-4 flex flex-wrap gap-3 overflow-hidden transition-all duration-500 ease-out ${open ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}
        aria-hidden={!open}>
        {SOCIAL_LINKS.map((s, i) => (
          <li key={s.id}
            className={`transition-all duration-500 ease-out ${open ? 'translate-x-0 opacity-100' : '-translate-x-3 opacity-0'}`}
            style={{ transitionDelay: `${open ? i * 45 : 0}ms` }}>
            <a href={s.href} target="_blank" rel="noopener noreferrer me" data-social-link={s.id}
              tabIndex={open ? 0 : -1}
              className="inline-block rounded-xl bg-white px-4 py-2 text-sm text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-100">
              {s.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
