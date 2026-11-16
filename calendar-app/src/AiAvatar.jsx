import SparkleIcon from './SparkleIcon.jsx'

// The assistant avatar: a sparkle on a dark disc.
// `active` makes it shine (rotating rays + soft pulse) while the AI is writing,
// then it returns to a stable state. Motion is disabled for reduced-motion users.
export default function AiAvatar({ active = false, size = 'md', label }) {
  const box = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-12 w-12' : 'h-8 w-8'
  const icon = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'
  return (
    <span className={`relative inline-flex ${box} shrink-0 items-center justify-center`} role="img" aria-label={label}>
      {active && (
        <>
          <span aria-hidden="true" className={`ai-rays absolute ${size === 'lg' ? '-inset-2' : '-inset-1'} rounded-full`} />
          <span aria-hidden="true" className={`ai-sweep absolute ${size === 'lg' ? '-inset-2' : '-inset-1'} rounded-full`} />
        </>
      )}
      <span className={`relative inline-flex ${box} items-center justify-center rounded-full bg-neutral-900 text-white ring-1 ring-neutral-900/10 ${active ? 'ai-pulse' : ''}`}>
        <SparkleIcon className={icon} filled />
      </span>
    </span>
  )
}
