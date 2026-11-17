import { useI18n } from './i18n/index.jsx'

// "Identity verified" badge. Shown only when the Stripe verification of the account succeeded.
export default function VerifiedBadge({ className = '' }) {
  const { t } = useI18n()
  return (
    <span title={t('identityBadgeHint')}
      className={`inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      {t('identityBadge')}
    </span>
  )
}
