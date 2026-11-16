import SparkleIcon from './SparkleIcon.jsx'

// The assistant avatar is the sparkle alone, with no disc or ring, matching the
// owner switch that turns the AI on and off in the chat.
// When `active`, it shines the same way the switch does while the AI writes.
export default function AiAvatar({ active = false, size = 'md', tone = 'dark', label }) {
  const box = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  const icon = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'
  const color = tone === 'light' ? 'text-white' : 'text-neutral-900'
  return (
    <span role="img" aria-label={label} className={`inline-flex ${box} shrink-0 items-center justify-center ${color}`}>
      <SparkleIcon className={`${icon} ${active ? 'ai-sparkle-live' : ''}`} filled />
    </span>
  )
}
