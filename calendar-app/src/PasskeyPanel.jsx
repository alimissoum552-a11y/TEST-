import { useEffect, useState } from 'react'
import { useI18n, LanguageSelect } from './i18n/index.jsx'
import { listPasskeys, addPasskey, removePasskey, deviceSupportsPasskey } from './passkeys.js'

// Manage the passkeys of this account: add this device, remove one.
export default function PasskeyPanel({ user, onClose }) {
  const { t, locale } = useI18n()
  const [items, setItems] = useState(null)
  const [supported, setSupported] = useState(null)
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => listPasskeys(user.id).then(setItems).catch((e) => setErr(e.message))
  useEffect(() => { load(); deviceSupportsPasskey().then(setSupported).catch(() => setSupported(false)) }, [user.id])

  async function add() {
    setBusy(true); setErr(null); setMsg(null)
    try {
      await addPasskey(navigator.platform || null)
      setMsg(t('passkeyAdded')); await load()
    } catch (e) {
      setErr(e?.name === 'NotAllowedError' || e?.name === 'AbortError' ? t('passkeyCancelled') : t('passkeyFailed'))
    } finally { setBusy(false) }
  }

  async function remove(id) {
    setBusy(true); setErr(null); setMsg(null)
    try { await removePasskey(id); await load() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl space-y-4 max-h-[90%] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-neutral-900">{t('passkeyTitle')}</h3>
        <p className="text-sm text-neutral-600">{t('passkeyIntro')}</p>

        {supported === false && <p className="text-sm font-medium text-neutral-900">{t('passkeyUnsupported')}</p>}

        {supported !== false && (
          <button type="button" onClick={add} disabled={busy || supported === null}
            className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">
            {busy ? '…' : t('passkeyAdd')}
          </button>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('passkeyDevices')}</p>
          {items && items.length === 0 && <p className="text-sm text-neutral-500">{t('passkeyNone')}</p>}
          {(items || []).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-neutral-800">
                {c.device_label || t('passkeyDevice')}
                <span className="text-neutral-400"> · {new Date(c.created_at).toLocaleDateString(locale)}</span>
              </span>
              <button type="button" onClick={() => remove(c.id)} disabled={busy}
                className="shrink-0 text-xs text-neutral-500 hover:text-neutral-900">{t('remove')}</button>
            </div>
          ))}
        </div>

        {msg && <p className="text-sm text-neutral-600">{msg}</p>}
        {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
        <p className="text-xs text-neutral-500">{t('passkeyNote')}</p>
        <button onClick={onClose} className="w-full py-2 rounded-xl bg-neutral-100 text-sm">{t('close')}</button>
      </div>
    </div>
  )
}
