// The AI sparkle. One drawing, reused everywhere the assistant appears,
// so the assistant keeps a single visual identity.
export default function SparkleIcon({ className = 'h-5 w-5', filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9.5 4.5c.4 3 2.1 4.8 5.1 5.2-3 .4-4.7 2.2-5.1 5.2-.4-3-2.1-4.8-5.1-5.2 3-.4 4.7-2.2 5.1-5.2z" />
      <path d="M18 3.5c.2 1.4.9 2.1 2.3 2.3-1.4.2-2.1.9-2.3 2.3-.2-1.4-.9-2.1-2.3-2.3 1.4-.2 2.1-.9 2.3-2.3z" />
      <path d="M17.5 14.5c.15 1 .6 1.45 1.6 1.6-1 .15-1.45.6-1.6 1.6-.15-1-.6-1.45-1.6-1.6 1-.15 1.45-.6 1.6-1.6z" />
    </svg>
  )
}
