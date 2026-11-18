import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import {
  getIdentityStatus, refreshIdentityStatus, listManagedProfiles, addManagedProfile, signManagedProfile,
  inviteGuardian, requestMinorConsent, createMinorAccess, regenerateMinorAccess, disableMinorAccess, removeManagedProfile, graduateMinor,
} from './lib/api.js'
import { isGroupKind, validBirthYear, needsResponsibleAdult, consentRequired } from './lib/family.js'

// Version of the declaration text. v2 adds the access of the minor to the calendar and the chat.
export const DECLARATION_VERSION = '2026-11-v2'
const field = 'w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 bg-white'
const small = 'text-xs text-neutral-900 underline underline-offset-2 disabled:opacity-50'

// Team calendars (family, sports team, class): managed minors, guardian consent under 13, the signed declaration,
// and the access identifier of each minor. The type of calendar is fixed when the team calendar is created.
export default function FamilyPanel({ calendar, userId, isOwner }) {
  const { t } = useI18n()
  const group = isGroupKind(calendar.kind)
  const [profiles, setProfiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({ first_name: '', birth_year: '', sex: '', category: '' })
  const [signingId, setSigningId] = useState(null)
  const [sign, setSign] = useState({ first: '', last: '', agree: false, ai: false, access: true })
  const [guardian, setGuardian] = useState({ profileId: '', email: '' })
  const [guardianDone, setGuardianDone] = useState(false) // false | 'added' | 'noMail' | 'invited'
  const [consentEmail, setConsentEmail] = useState({})
  const [issued, setIssued] = useState(null) // { name, id }: shown once
  const [removingId, setRemovingId] = useState(null)
  const [grad, setGrad] = useState(null) // { id, email, role, confirmed } while the adult-account form is open

  // The owner's verified name is needed to sign. If Stripe's name was not stored yet, read it again.
  useEffect(() => {
    if (!isOwner || !group) return
    getIdentityStatus(userId).then(async (s) => {
      if (s.status === 'verified' && !s.verified_name) await refreshIdentityStatus().catch(() => {})
    }).catch(() => {})
  }, [isOwner, group, userId])

  const reload = () => listManagedProfiles(calendar.id).then(setProfiles).catch((ex) => setErr(ex.message))
  useEffect(() => { if (group) reload() }, [calendar.id, group])  // eslint-disable-line react-hooks/exhaustive-deps

  function errorKey(message) {
    return ({
      name_mismatch: 'famErrNameMismatch',
      creator_not_verified: 'famErrCreator',
      account_not_found: 'famErrNoAccount',
      identity_name_missing: 'famErrNameMissing',
      account_name_missing: 'famErrAccountName',
      consent_required: 'fmErrConsent',
      declaration_missing_access: 'fmErrAccessDecl',
      invalid_email: 'fmErrEmail',
      is_owner: 'fmErrGuardianOwner',
      email_failed: 'fmErrEmailSend',
      plan_limit_members: 'planLimitMembers',
      too_young: 'fmErrTooYoung',
      age_not_confirmed: 'fmErrAgeConfirm',
      email_in_use: 'fmErrEmailInUse',
    })[message] || 'famErrGeneric'
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
      setNotice(consentRequired(year) ? t('fmAddedConsent') : t('famAdded'))
    } catch (ex) { setErr(t('famErrGeneric')) } finally { setBusy(false) }
  }

  async function sendConsent(p) {
    const email = (consentEmail[p.id] ?? p.guardian_email ?? '').trim()
    setBusy(true); setErr(null); setNotice(null)
    try {
      await requestMinorConsent(p.id, email)
      setNotice(t('fmConsentSent'))
      await reload()
    } catch (ex) { setErr(t(errorKey(ex.message))) } finally { setBusy(false) }
  }

  async function signProfile(profile) {
    setBusy(true); setErr(null)
    try {
      const functions = [
        ...(profile.sex ? ['sex'] : []), ...(sign.ai ? ['ai'] : []), ...(sign.access ? ['access'] : []),
      ]
      await signManagedProfile(profile.id, { first: sign.first, last: sign.last, functions, version: DECLARATION_VERSION })
      setSigningId(null)
      setSign({ first: '', last: '', agree: false, ai: false, access: true })
      setNotice(t('famSigned'))
      if (functions.includes('access')) {
        const res = await createMinorAccess(profile.id)
        setIssued({ name: profile.first_name, id: res.access_id })
      }
      await reload()
    } catch (ex) {
      setErr(t(errorKey(ex.message)))
      if (ex.message === 'identity_name_missing') refreshIdentityStatus().catch(() => {})
      await reload()
    } finally { setBusy(false) }
  }

  async function access(p, action) {
    setBusy(true); setErr(null); setNotice(null)
    try {
      if (action === 'disable') { await disableMinorAccess(p.id) }
      else {
        const res = await (action === 'create' ? createMinorAccess(p.id) : regenerateMinorAccess(p.id))
        setIssued({ name: p.first_name, id: res.access_id })
      }
      await reload()
    } catch (ex) { setErr(t(errorKey(ex.message))) } finally { setBusy(false) }
  }

  // At 16, the owner turns the minor's access into the teenager's own account (minor-access, action graduate).
  async function graduate(p) {
    if (!grad?.confirmed) { setErr(t('fmErrAgeConfirm')); return }
    setBusy(true); setErr(null); setNotice(null)
    try {
      await graduateMinor(p.id, grad.email.trim(), grad.role)
      setGrad(null)
      setNotice(t('fmGradDone').replace('{name}', p.first_name))
      await reload()
    } catch (ex) { setErr(t(errorKey(ex.message))) } finally { setBusy(false) }
  }

  // Owner only. The server deletes the technical account of the minor with the profile.
  async function removeProfile(p) {
    setBusy(true); setErr(null); setNotice(null)
    try {
      await removeManagedProfile(p.id)
      setRemovingId(null)
      setNotice(t('tmRemoved'))
      await reload()
    } catch (ex) { setErr(t(errorKey(ex.message))) } finally { setBusy(false) }
  }

  async function copyId() {
    try { await navigator.clipboard.writeText(issued.id) } catch { /* clipboard unavailable */ }
  }

  // A personal calendar stays personal: team calendars are created from the menu.
  if (!group) {
    return isOwner && calendar.is_default
      ? <p className="rounded-2xl border border-neutral-200 p-4 text-xs text-neutral-600">{t('famDefaultHint')}</p>
      : null
  }

  return (
    <section className="rounded-2xl border border-neutral-200 p-4 space-y-4" aria-label={t('famTitle')}>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-neutral-900">{t(`famKind_${calendar.kind}`)}</p>
        <p className="text-xs text-neutral-500">{t('famKindNote')}</p>
      </div>

      {issued && (
        <div role="alert" className="rounded-xl border border-neutral-900 p-3 space-y-2">
          <p className="text-xs font-semibold text-neutral-900">{t('fmAccessTitle').replace('{name}', issued.name)}</p>
          <p className="font-mono text-lg tracking-widest text-neutral-900 select-all">{issued.id}</p>
          <p className="text-xs text-neutral-700">{t('fmAccessOnce')}</p>
          <div className="flex gap-3">
            <button type="button" onClick={copyId} className={small}>{t('fmAccessCopy')}</button>
            <button type="button" onClick={() => setIssued(null)} className={small}>{t('close')}</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-900">{t('famMinors')}</p>
        {profiles.length === 0 && <p className="text-xs text-neutral-500">{t('famMinorsEmpty')}</p>}

        <ul className="divide-y divide-neutral-100">
          {profiles.map((p) => {
            const needConsent = consentRequired(p.birth_year)
            const consentOk = !needConsent || p.consent_status === 'approved'
            return (
              <li key={p.id} className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-neutral-900">
                    {p.first_name} · {p.birth_year}{p.category ? ` · ${p.category}` : ''}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${p.status === 'active' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
                    {p.status === 'active' ? t('famStatusActive') : t('famStatusPending')}
                  </span>
                </div>

                {isOwner && p.status === 'pending' && needConsent && (
                  <div className="rounded-xl bg-neutral-50 p-3 space-y-2">
                    {p.consent_status === 'approved'
                      ? <p className="text-xs text-neutral-700">{t('fmConsentApproved')}</p>
                      : (
                        <>
                          <p className="text-xs text-neutral-700">{t('fmConsentNeeded')}</p>
                          {p.consent_status === 'pending' && <p className="text-xs text-neutral-500">{t('fmConsentPending')}</p>}
                          <div className="flex gap-2">
                            <input type="email" className={field} placeholder={t('fmGuardianEmail')}
                              value={consentEmail[p.id] ?? p.guardian_email ?? ''}
                              onChange={(e) => setConsentEmail({ ...consentEmail, [p.id]: e.target.value })} />
                            <button type="button" onClick={() => sendConsent(p)} disabled={busy}
                              className="shrink-0 px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">
                              {p.consent_status === 'pending' ? t('fmConsentResend') : t('fmConsentSend')}
                            </button>
                          </div>
                        </>
                      )}
                  </div>
                )}

                {isOwner && p.status === 'pending' && consentOk && signingId !== p.id && (
                  <button type="button" onClick={() => { setSigningId(p.id); setErr(null) }} className={small}>{t('famSignOpen')}</button>
                )}

                {isOwner && p.status === 'pending' && consentOk && signingId === p.id && (
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
                      <input type="checkbox" checked={sign.access} onChange={(e) => setSign({ ...sign, access: e.target.checked })}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-neutral-900" />
                      <span>{t('fmSignAccess')}</span>
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

                {isOwner && (
                  removingId === p.id ? (
                    <div className="rounded-xl bg-neutral-50 p-3 space-y-2">
                      <p className="text-xs text-neutral-700">{t('tmRemoveMinorConfirm').replace('{name}', p.first_name)}</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setRemovingId(null)} className="flex-1 py-2 rounded-xl bg-neutral-100 text-xs">{t('cancel')}</button>
                        <button type="button" onClick={() => removeProfile(p)} disabled={busy}
                          className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">{t('tmConfirm')}</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setRemovingId(p.id); setErr(null) }} className="text-xs text-neutral-500 hover:text-neutral-900">{t('remove')}</button>
                  )
                )}

                {isOwner && p.status === 'active' && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-700">
                    {!p.auth_user_id ? (
                      <button type="button" onClick={() => access(p, 'create')} disabled={busy} className={small}>{t('fmAccessCreate')}</button>
                    ) : (
                      <>
                        <span>{p.access_disabled ? t('fmAccessDisabled') : t('fmAccessActive')}</span>
                        <button type="button" onClick={() => access(p, 'regenerate')} disabled={busy} className={small}>{t('fmAccessRegen')}</button>
                        {!p.access_disabled && <button type="button" onClick={() => access(p, 'disable')} disabled={busy} className={small}>{t('fmAccessDisable')}</button>}
                        {new Date().getFullYear() - Number(p.birth_year) >= 16 && grad?.id !== p.id && (
                          <button type="button" onClick={() => setGrad({ id: p.id, email: '', role: 'reader', confirmed: false })} disabled={busy} className={small} data-graduate={p.id}>{t('fmGradButton')}</button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {isOwner && grad?.id === p.id && (
                  <form className="mt-2 space-y-2 rounded-2xl ring-1 ring-neutral-300 p-3" onSubmit={(e) => { e.preventDefault(); graduate(p) }} data-graduate-form>
                    <p className="text-xs text-neutral-700">{t('fmGradIntro').replace('{name}', p.first_name)}</p>
                    <label className="block text-xs text-neutral-700">{t('fmGradEmail')}
                      <input type="email" required value={grad.email} onChange={(e) => setGrad({ ...grad, email: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-sm" />
                    </label>
                    <label className="block text-xs text-neutral-700">{t('fmGradRole')}
                      <select value={grad.role} onChange={(e) => setGrad({ ...grad, role: e.target.value })} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-sm">
                        <option value="reader">{t('reader')}</option>
                        <option value="contributor">{t('contributor')}</option>
                      </select>
                    </label>
                    <label className="flex items-start gap-2 text-xs text-neutral-700">
                      <input type="checkbox" checked={grad.confirmed} onChange={(e) => setGrad({ ...grad, confirmed: e.target.checked })} />
                      <span>{t('fmGradConfirm').replace('{name}', p.first_name)}</span>
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setGrad(null)} disabled={busy} className="flex-1 py-1.5 rounded-xl bg-neutral-100 text-xs">{t('cancel')}</button>
                      <button type="submit" disabled={busy || !grad.confirmed || !grad.email.trim()} className="flex-1 py-1.5 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-40">{t('fmGradSubmit')}</button>
                    </div>
                  </form>
                )}
              </li>
            )
          })}
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
              </select>
              <p className="text-[11px] text-neutral-500">{t('famSexWhy')}</p>
            </div>
            <input className={field} maxLength={40} placeholder={t('famCategory')} value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <button type="submit" disabled={busy} className="w-full py-2 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">{t('famAdd')}</button>
          </form>
        )}
      </div>

      {isOwner && profiles.length > 0 && (
        <form onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true); setErr(null); setGuardianDone(false)
          try {
            const res = await inviteGuardian(guardian.profileId, guardian.email.trim())
            setGuardian({ profileId: guardian.profileId, email: '' })
            setGuardianDone(res.linked ? (res.emailed ? 'added' : 'noMail') : 'invited')
          } catch (ex) { setErr(t(errorKey(ex.message))) } finally { setBusy(false) }
        }} className="rounded-xl border border-neutral-200 p-3 space-y-3">
          <p className="text-xs font-semibold text-neutral-900">{t('famGuardianTitle')}</p>
          <select className={field} required value={guardian.profileId} aria-label={t('famGuardianProfile')}
            onChange={(e) => setGuardian({ ...guardian, profileId: e.target.value })}>
            <option value="">{t('famGuardianProfile')}</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.first_name}</option>)}
          </select>
          <input className={field} type="email" required placeholder={t('famGuardianEmail')} value={guardian.email}
            onChange={(e) => setGuardian({ ...guardian, email: e.target.value })} />
          <button type="submit" disabled={busy || !guardian.profileId || !guardian.email.trim()}
            className="w-full py-2 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">{t('famGuardianAdd')}</button>
          {guardianDone && <p className="text-xs text-neutral-700">{t({ added: 'famGuardianAdded', noMail: 'fmGuardianNoMail', invited: 'fmGuardianInvited' }[guardianDone])}</p>}
        </form>
      )}

      {err && <p className="text-xs font-medium text-neutral-900">{err}</p>}
      {notice && !err && <p className="text-xs text-neutral-700">{notice}</p>}
    </section>
  )
}
