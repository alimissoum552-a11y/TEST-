// Collyo brand mark (public/logo.png) with the name beside it. The image is decorative: the text carries the name.
export default function Logo({ size = 28, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src="/logo.png" alt="" width={size} height={size} className="shrink-0" draggable="false" />
      <span className="text-lg font-semibold tracking-tight">Collyo</span>
    </span>
  )
}
