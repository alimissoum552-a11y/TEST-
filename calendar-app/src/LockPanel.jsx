import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { registerPasskey, verifyPasskey, clearPasskey, supportsDeviceUnlock } from './lock.js'

// Small menu behind the lock icon: use the device unlock, remove it, or lock now.
export default function LockPanel({ enabled, inline = false, user, onClose, onChanged, onLockNow }) {
  const { t } = useI18n()
  const [supported, setSupported] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { supportsDeviceUnlock().then(setSupported).catch(() => setSupported(false)) }, [])

  async function enable() {
    setBusy(true); setErr(null)
    try { await registerPasskey(user); onChanged(true); onClose?.() }
    catch (e) { setErr(e?.name === 'NotAllowedError' ? t('lockCancelled') : (e?.message === 'cancelled' ? t('lockCancelled') : t('lockFailed'))) }
    finally { setBusy(false) }
  }

  async function disable() {
    setBusy(true); setErr(null)
    try {
      if (!(await verifyPasskey())) { setErr(t('lockFailed')); return }
      clearPasskey(); onChanged(false)
    } catch (e) { setErr(e?.name === 'NotAllowedError' ? t('lockCancelled') : t('lockFailed')) }
    finally { setBusy(false) }
  }

  return (
    <div className={inline
      ? 'w-full rounded-2xl border border-neutral-200 p-4 space-y-3'
      : 'absolute end-0 top-full z-30 mt-2 w-64 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-neutral-200 space-y-3'}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900">{t('lockMenuTitle')}</p>
        {onClose && <button type="button" onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-900">{t('close')}</button>}
      </div>

      {supported === false && <p className="text-xs font-medium text-neutral-900">{t('lockUnsupported')}</p>}

      {supported !== false && (
        <>
          <p className="text-xs text-neutral-500">{enabled ? t('lockEnabled') : t('lockDisabled')}</p>
          {!enabled ? (
            <button type="button" onClick={enable} disabled={busy || supported === null}
              className="w-full py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">
              {busy ? '…' : t('lockEnable')}
            </button>
          ) : (
            <>
              <button type="button" onClick={onLockNow} className="w-full py-2 rounded-xl bg-neutral-900 text-white text-sm">{t('lockLockNow')}</button>
              <button type="button" onClick={disable} disabled={busy} className="w-full py-2 rounded-xl bg-neutral-100 text-neutral-900 text-sm disabled:opacity-50">
                {busy ? '…' : t('lockDisable')}
              </button>
            </>
          )}
          <p className="text-xs text-neutral-500">{t('lockNote')}</p>
        </>
      )}

      {err && <p className="text-xs font-medium text-neutral-900">{err}</p>}
    </div>
  )
}
