import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import {
  getIdentityStatus, startIdentityVerification, setCalendarKind,
  listManagedProfiles, addManagedProfile, signManagedProfile, addGuardianByEmail,
} from './lib/api.js'
import { isGroupKind, validBirthYear, needsResponsibleAdult } from './lib/family.js'

export const DECLARATION_VERSION = '2026-11-v1'
const KINDS = ['work', 'family', 'sports', 'class']
const field = 'w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 bg-white'

// Family, sports team and class modes: calendar type, creator verification, and managed minor profiles.
// Minors are added here by the owner and stay pending until an adult responsible signs the declaration.
export default function FamilyPanel({ calendar, userId, isOwner }) {
  const { t } = useI18n()
  const [kind, setKind] = useState(calendar.kind || 'work')
  const [identity, setIdentity] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({ first_name: '', birth_year: '', sex: '', category: '' })
  const [signingId, setSigningId] = useState(null)
  const [sign, setSign] = useState({ first: '', last: '', agree: false, ai: false })
  const [guardian, setGuardian] = useState({ profileId: '', email: '' })
  const [guardianDone, setGuardianDone] = useState(false)

  useEffect(() => {
    if (isOwner) getIdentityStatus(userId).then(setIdentity).catch(() => setIdentity({ status: 'none' }))
  }, [isOwner, userId])

  useEffect(() => {
    if (isGroupKind(kind)) listManagedProfiles(calendar.id).then(setProfiles).catch((ex) => setErr(ex.message))
  }, [calendar.id, kind])

  function errorKey(message) {
    return ({
      name_mismatch: 'famErrNameMismatch',
      creator_not_verified: 'famErrCreator',
      account_not_found: 'famErrNoAccount',
    })[message] || 'famErrGeneric'
  }

  async function changeKind(next) {
    setBusy(true); setErr(null); setNotice(null)
    try {
      setKind(await setCalendarKind(calendar.id, next))
    } catch (ex) {
      setErr(ex.message === 'creator_not_verified' ? t('famErrCreator') : t(errorKey(ex.message)))
    } finally { setBusy(false) }
  }

  async function verify() {
    setBusy(true); setErr(null)
    try {
      const res = await startIdentityVerification()
      if (res?.status === 'verified') { setIdentity({ status: 'verified' }); return }
      if (res?.url) window.location.href = res.url
    } catch (ex) { setErr(t('famErrGeneric')) } finally { setBusy(false) }
  }

  async function addMinor(e) {
    e.preventDefault()
    setErr(null); setNotice(null)
    const year = Number(form.birth_year)
    if (!validBirthYear(year)) { setErr(t('famErrYear')); return }
    setBusy(true)
    try {
      const row = await addManagedProfile(calendar.id, userId, {
        first_name: form.first_name.trim(), birth_year: year, sex: form.sex, category: form.category.trim(),
      })
      setProfiles((list) => [...list, row])
      setForm({ first_name: '', birth_year: '', sex: '', category: '' })
      setNotice(t('famAdded'))
    } catch (ex) { setErr(t('famErrGeneric')) } finally { setBusy(false) }
  }

  async function signProfile(profile) {
    setBusy(true); setErr(null)
    try {
      const functions = [...(profile.sex ? ['sex'] : []), ...(sign.ai ? ['ai'] : [])]
      const updated = await signManagedProfile(profile.id, {
        first: sign.first, last: sign.last, functions, version: DECLARATION_VERSION,
      })
      setProfiles((list) => list.map((p) => (p.id === profile.id ? { ...p, ...updated } : p)))
      setSigningId(null)
      setSign({ first: '', last: '', agree: false, ai: false })
      setNotice(t('famSigned'))
    } catch (ex) { setErr(t(errorKey(ex.message))) } finally { setBusy(false) }
  }

  const group = isGroupKind(kind)

  return (
    <section className="rounded-2xl border border-neutral-200 p-4 space-y-4" aria-label={t('famTitle')}>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-neutral-900">{t('famTitle')}</p>
        <p className="text-xs text-neutral-500">{t('famKindNote')}</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="fam-kind" className="block text-sm font-medium text-neutral-900">{t('famKindLabel')}</label>
        <select id="fam-kind" className={field} value={kind} disabled={!isOwner || busy}
          onChange={(e) => changeKind(e.target.value)}>
          {KINDS.map((k) => <option key={k} value={k}>{t(`famKind_${k}`)}</option>)}
        </select>
      </div>

      {isOwner && identity && group && identity.status !== 'verified' && (
        <div className="rounded-xl bg-neutral-50 p-3 space-y-2">
          <p className="text-xs text-neutral-700">{identity.status === 'pending' ? t('famIdentityPending') : t('famVerifyNeeded')}</p>
          {identity.status !== 'pending' && (
            <button type="button" onClick={verify} disabled={busy}
              className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">{t('famVerifyButton')}</button>
          )}
        </div>
      )}
      {isOwner && identity?.status === 'verified' && group && (
        <p className="text-xs text-neutral-700">{t('famIdentityVerified')}</p>
      )}

      {group && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-neutral-900">{t('famMinors')}</p>
          {profiles.length === 0 && <p className="text-xs text-neutral-500">{t('famMinorsEmpty')}</p>}

          <ul className="divide-y divide-neutral-100">
            {profiles.map((p) => (
              <li key={p.id} className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-neutral-900">
                    {p.first_name} · {p.birth_year}{p.category ? ` · ${p.category}` : ''}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${p.status === 'active' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
                    {p.status === 'active' ? t('famStatusActive') : t('famStatusPending')}
                  </span>
                </div>

                {isOwner && p.status === 'pending' && signingId !== p.id && (
                  <button type="button" onClick={() => { setSigningId(p.id); setErr(null) }}
                    className="text-xs text-neutral-900 underline underline-offset-2">{t('famSignOpen')}</button>
                )}

                {isOwner && p.status === 'pending' && signingId === p.id && (
                  <div className="rounded-xl bg-neutral-50 p-3 space-y-3">
                    <p className="text-xs font-semibold text-neutral-900">{t('famSignTitle')}</p>
                    <p className="text-xs leading-relaxed text-neutral-700">{t('famSignText')}</p>
                    {needsResponsibleAdult(p.birth_year) && <p className="text-xs text-neutral-500">{t('famSignUnder')}</p>}
                    {p.sex && <p className="text-xs text-neutral-700">{t('famSignSex')}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <input className={field} placeholder={t('famSignFirst')} value={sign.first} onChange={(e) => setSign({ ...sign, first: e.target.value })} />
                      <input className={field} placeholder={t('famSignLast')} value={sign.last} onChange={(e) => setSign({ ...sign, last: e.target.value })} />
                    </div>
                    <label className="flex items-start gap-2 text-xs text-neutral-800">
                      <input type="checkbox" checked={sign.agree} onChange={(e) => setSign({ ...sign, agree: e.target.checked })}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-neutral-900" />
                      <span>{t('famSignCheck')}</span>
                    </label>
                    <label className="flex items-start gap-2 text-xs text-neutral-800">
                      <input type="checkbox" checked={sign.ai} onChange={(e) => setSign({ ...sign, ai: e.target.checked })}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-neutral-900" />
                      <span>
                        <span className="block">{t('famSignAi')}</span>
                        <span className="block text-neutral-500 mt-0.5">{t('famAiNote')}</span>
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSigningId(null)} className="flex-1 py-2 rounded-xl bg-neutral-100 text-xs">{t('cancel')}</button>
                      <button type="button" onClick={() => signProfile(p)}
                        disabled={busy || !sign.agree || !sign.first.trim() || !sign.last.trim()}
                        className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">{t('famSignButton')}</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {isOwner && (
            <form onSubmit={addMinor} className="rounded-xl border border-neutral-200 p-3 space-y-3">
              <p className="text-xs font-semibold text-neutral-900">{t('famAddTitle')}</p>
              <input className={field} required maxLength={60} placeholder={t('famFirstName')} value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              <input className={field} required type="number" min={1990} max={new Date().getUTCFullYear()} placeholder={t('famBirthYear')}
                value={form.birth_year} onChange={(e) => setForm({ ...form, birth_year: e.target.value })} />
              <div className="space-y-1">
                <select className={field} value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} aria-label={t('famSex')}>
                  <option value="">{t('famSexNone')}</option>
                  <option value="female">{t('famSexFemale')}</option>
                  <option value="male">{t('famSexMale')}</option>
                  <option value="other">{t('famSexOther')}</option>
                </select>
                <p className="text-[11px] text-neutral-500">{t('famSexWhy')}</p>
              </div>
              <input className={field} maxLength={40} placeholder={t('famCategory')} value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <button type="submit" disabled={busy} className="w-full py-2 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">{t('famAdd')}</button>
            </form>
          )}
        </div>
      )}

      {isOwner && group && profiles.length > 0 && (
        <form onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true); setErr(null); setGuardianDone(false)
          try {
            await addGuardianByEmail(guardian.profileId, guardian.email.trim())
            setGuardian({ profileId: guardian.profileId, email: '' })
            setGuardianDone(true)
          } catch (ex) { setErr(t(errorKey(ex.message))) } finally { setBusy(false) }
        }} className="rounded-xl border border-neutral-200 p-3 space-y-3">
          <p className="text-xs font-semibold text-neutral-900">{t('famGuardianTitle')}</p>
          <select className={field} required value={guardian.profileId} aria-label={t('famGuardianProfile')}
            onChange={(e) => setGuardian({ ...guardian, profileId: e.target.value })}>
            <option value="">{t('famGuardianProfile')}</option>
            {profiles.filter((p) => p.status !== 'removed').map((p) => <option key={p.id} value={p.id}>{p.first_name}</option>)}
          </select>
          <input className={field} type="email" required placeholder={t('famGuardianEmail')} value={guardian.email}
            onChange={(e) => setGuardian({ ...guardian, email: e.target.value })} />
          <button type="submit" disabled={busy || !guardian.profileId || !guardian.email.trim()}
            className="w-full py-2 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">{t('famGuardianAdd')}</button>
          {guardianDone && <p className="text-xs text-neutral-700">{t('famGuardianAdded')}</p>}
        </form>
      )}

      {err && <p className="text-xs font-medium text-neutral-900">{err}</p>}
      {notice && !err && <p className="text-xs text-neutral-700">{notice}</p>}
    </section>
  )
}
