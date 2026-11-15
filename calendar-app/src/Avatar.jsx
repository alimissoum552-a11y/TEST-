// Circular avatar: the photo if set, otherwise the first letter of the name or email.
export default function Avatar({ name, email, url, size = 'h-8 w-8', text = 'text-sm' }) {
  const initial = (name || email || '?').trim().charAt(0).toUpperCase()
  if (url) {
    return <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover ring-1 ring-neutral-200`} />
  }
  return (
    <span aria-hidden="true"
      className={`${size} ${text} shrink-0 inline-flex items-center justify-center rounded-full bg-neutral-900 font-medium text-white`}>
      {initial}
    </span>
  )
}
