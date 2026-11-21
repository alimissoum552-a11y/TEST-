import { useState } from 'react'
import { useI18n } from './i18n/index.jsx'

// A link inside a chat message: a small round avatar with the platform initial.
// Opening it always asks the user first, then opens in a new tab.
export default function LinkChip({ url, label }) {
  const { t } = useI18n()
  const [ask, setAsk] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAsk(true)}
        className="mx-0.5 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-0.5 align-baseline text-xs text-neutral-800 hover:bg-neutral-200">
        <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900 text-[9px] font-semibold text-white">
          {label.slice(0, 1).toUpperCase()}
        </span>
        {label}
      </button>
      {ask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAsk(false)}>
          <div className="w-full max-w-xs space-y-3 rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-neutral-900">{t('openLinkTitle')}</p>
            <p className="break-all text-xs text-neutral-500">{url}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAsk(false)}
                className="flex-1 rounded-xl bg-neutral-100 py-2 text-sm">{t('cancel')}</button>
              <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => setAsk(false)}
                className="flex-1 rounded-xl bg-neutral-900 py-2 text-center text-sm text-white">{t('openLink')}</a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
