import { useState } from 'react'
import { useI18n } from './i18n/index.jsx'

// In-app guide: how to add Collyo to Claude as a custom connector, with the server address to copy.
const SERVER_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`
  : ''

export default function ConnectorGuide({ onClose }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(SERVER_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable: the address is selectable in the field below.
    }
  }

  const steps = ['connectorStep1', 'connectorStep2', 'connectorStep3', 'connectorStep4', 'connectorStep5']

  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl space-y-5 max-h-[90%] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-neutral-900">{t('connectorTitle')}</h3>
          <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">{t('close')}</button>
        </div>

        <p className="text-sm text-neutral-700">{t('connectorIntro')}</p>

        <ol className="list-decimal ps-5 space-y-2 text-sm text-neutral-800">
          {steps.map((k) => <li key={k}>{t(k)}</li>)}
        </ol>

        <div className="space-y-2">
          <label htmlFor="connector-url" className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('connectorUrlLabel')}</label>
          <div className="flex gap-2">
            <input id="connector-url" readOnly value={SERVER_URL} onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900 bg-neutral-50" />
            <button type="button" onClick={copy}
              className="shrink-0 px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">
              {copied ? t('connectorCopied') : t('connectorCopy')}
            </button>
          </div>
        </div>

        <p className="text-xs text-neutral-500">{t('connectorPlan')}</p>
        <p className="text-xs text-neutral-500">{t('connectorManage')}</p>
      </div>
    </div>
  )
}
