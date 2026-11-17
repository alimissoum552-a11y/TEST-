import { useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { pinValid, setPasscode, verifyPasscode, clearPasscode } from './lock.js'

// Small menu behind the lock icon: enable, change, disable the local passcode,
// or lock the app right away.
export default function LockPanel({ enabled, onClose, onChanged, onLockNow }) {
  const { t } = useI18n()
  const [mode, setMode] = useState('menu') // menu | set | disable
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState(null)
  const input = 'w-full rounded-xl border border-neutral-200 px-3 py-2 text-center tracking-[0.3em] placeholder:tracking-normal text-sm focus:outline-none focus:border-neutral-900'

  async function save(e) {
    e.preventDefault()
    setErr(null)
    if (!pinValid(pin)) return setErr(t('lockPinRule'))
    if (pin !== confirm) return setErr(t('lockMismatch'))
    await setPasscode(pin)
    setPin(''); setConfirm(''); onChanged(true); setMode('menu')
  }

  async function remove(e) {
    e.preventDefault()
    setErr(null)
    if (!(await verifyPasscode(pin))) { setPin(''); return setErr(t('lockWrong')) }
    clearPasscode(); setPin(''); onChanged(false); setMode('menu')
  }

  return (
    <div className="absolute end-0 top-full z-30 mt-2 w-64 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-neutral-200 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900">{t('lockMenuTitle')}</p>
        <button type="button" onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-900">{t('close')}</button>
      </div>

      {mode === 'menu' && (
        <>
          <p className="text-xs text-neutral-500">{enabled ? t('lockEnabled') : t('lockDisabled')}</p>
          {!enabled ? (
            <button type="button" onClick={() => { setMode('set'); setErr(null) }}
              className="w-full py-2 rounded-xl bg-neutral-900 text-white text-sm">{t('lockEnable')}</button>
          ) : (
            <>
              <button type="button" onClick={onLockNow}
                className="w-full py-2 rounded-xl bg-neutral-900 text-white text-sm">{t('lockLockNow')}</button>
              <button type="button" onClick={() => { setMode('set'); setErr(null); setPin(''); setConfirm('') }}
                className="w-full py-2 rounded-xl bg-neutral-100 text-neutral-900 text-sm">{t('lockChange')}</button>
              <button type="button" onClick={() => { setMode('disable'); setErr(null); setPin('') }}
                className="w-full py-2 rounded-xl bg-neutral-100 text-neutral-900 text-sm">{t('lockDisable')}</button>
            </>
          )}
          <p className="text-xs text-neutral-500">{t('lockNote')}</p>
        </>
      )}

      {mode === 'set' && (
        <form onSubmit={save} className="space-y-2">
          <input className={input} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            inputMode="numeric" autoComplete="off" placeholder={t('lockNew')} aria-label={t('lockNew')} />
          <input className={input} value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 8))}
            inputMode="numeric" autoComplete="off" placeholder={t('lockConfirm')} aria-label={t('lockConfirm')} />
          {err && <p className="text-xs font-medium text-neutral-900">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setMode('menu'); setPin(''); setConfirm('') }}
              className="flex-1 py-2 rounded-xl bg-neutral-100 text-sm">{t('cancel')}</button>
            <button className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm">{t('lockSave')}</button>
          </div>
        </form>
      )}

      {mode === 'disable' && (
        <form onSubmit={remove} className="space-y-2">
          <input className={input} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            inputMode="numeric" autoComplete="off" placeholder={t('lockPlaceholder')} aria-label={t('lockPlaceholder')} />
          {err && <p className="text-xs font-medium text-neutral-900">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setMode('menu'); setPin('') }} className="flex-1 py-2 rounded-xl bg-neutral-100 text-sm">{t('cancel')}</button>
            <button className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm">{t('lockDisable')}</button>
          </div>
        </form>
      )}
    </div>
  )
}
