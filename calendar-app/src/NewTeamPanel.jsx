import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { getIdentityStatus, startIdentityVerification, createTeamCalendar } from './lib/api.js'
import { GROUP_KINDS } from './lib/family.js'
import PlanLimitNote, { planLimitCode } from './PlanLimitNote.jsx'

const field = 'w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 bg-white'
const SUGGESTION_KEY = { family: 'ntSugFamily', sports: 'ntSugSports', class: 'ntSugClass' }

// A calendar dedicated to a family, a sports team or a class. Only its members can see it. The creator must be verified.
// The name is chosen freely; the suggestion comes from the verified name, never from the e-mail address.
export default function NewTeamPanel({ user, onClose, onCreated }) {
  const { t } = useI18n()
  const [identity, setIdentity] = useState(null)
  const [kind, setKind] = useState('family')
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [limit, setLimit] = useState(null)

  useEffect(() => {
    getIdentityStatus(user.id).then(setIdentity).catch(() => setIdentity({ status: 'none' }))
  }, [user.id])

  // Suggestion: follows the type until the owner types a name.
  const suggestion = identity?.verified_name ? t(SUGGESTION_KEY[kind]).replace('{n}', identity.verified_name) : ''
  useEffect(() => { if (!touched) setName(suggestion) }, [suggestion, touched])

  const verified = identity?.status === 'verified'

  async function verify() {
    setBusy(true); setErr(null)
    try {
      const res = await startIdentityVerification()
      if (res?.url) window.location.href = res.url
      else if (res?.status === 'verified') setIdentity({ ...identity, status: 'verified' })
    } catch (ex) { setErr(`${t('famErrGeneric')} [${ex.message}${ex.detail ? `: ${ex.detail}` : ''}]`) }
    finally { setBusy(false) }
  }

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true); setErr(null); setLimit(null)
    try {
      const cal = await createTeamCalendar(user.id, name.trim(), kind)
      onCreated?.(cal.id)
      onClose()
    } catch (ex) {
      const code = planLimitCode(ex.message)
      if (code) setLimit(code)
      else setErr(ex.message === 'creator_not_verified' ? t('famErrCreator') : t('famErrGeneric'))
    } finally { setBusy(false) }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl space-y-4 max-h-[90%] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-neutral-900">{t('ntTitle')}</h3>
          <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">{t('close')}</button>
        </div>
        <p className="text-xs text-neutral-600">{t('ntIntro')}</p>

        <div className="space-y-1">
          <label htmlFor="nt-kind" className="block text-sm font-medium text-neutral-900">{t('famKindLabel')}</label>
          <select id="nt-kind" className={field} value={kind} disabled={busy} onChange={(e) => setKind(e.target.value)}>
            {GROUP_KINDS.map((k) => <option key={k} value={k}>{t(`famKind_${k}`)}</option>)}
          </select>
        </div>

        {identity && !verified && (
          <div className="rounded-xl bg-neutral-50 p-3 space-y-2">
            <p className="text-xs text-neutral-700">{identity.status === 'pending' ? t('famIdentityPending') : t('famVerifyNeeded')}</p>
            <button type="button" onClick={verify} disabled={busy}
              className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">{t('famVerifyButton')}</button>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="nt-name" className="block text-sm font-medium text-neutral-900">{t('ntName')}</label>
          <input id="nt-name" className={field} required maxLength={80} value={name} disabled={busy}
            onChange={(e) => { setTouched(true); setName(e.target.value) }} />
          <p className="text-xs text-neutral-500">{t('ntNameHint')}</p>
        </div>

        {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
        <PlanLimitNote code={limit} />
        <button type="submit" disabled={busy || !verified || !name.trim()}
          className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('ntCreate')}</button>
      </form>
    </div>
  )
}
