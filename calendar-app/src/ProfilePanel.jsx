import { useEffect, useRef, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import Avatar from './Avatar.jsx'
import { revokeMcpGrant } from './passkeys.js'
import { getMyProfile, uploadAvatar, removeAvatar, listMyGrants, revokeMyGrant, setMyHandle, getIdentityStatus, updateMyName, deleteMyAccount } from './lib/api.js'
import { supabase } from './lib/supabase.js'
import VerifiedBadge from './VerifiedBadge.jsx'
import PlanSection from './PlanSection.jsx'

// Lets the user see their avatar, change it to a photo, or remove it.
export default function ProfilePanel({ user, onClose, onChanged, onHandleChanged, justSubscribed = false }) {
  const { t } = useI18n()
  const [profile, setProfile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)
  const [grants, setGrants] = useState(null)
  const [handleInput, setHandleInput] = useState('')
  const [hBusy, setHBusy] = useState(false)
  const [hMsg, setHMsg] = useState(null)
  const [nameInput, setNameInput] = useState('')
  const [nBusy, setNBusy] = useState(false)
  const [nMsg, setNMsg] = useState(null)
  const [identity, setIdentity] = useState(null)
  const [delOpen, setDelOpen] = useState(false)
  const [delEmail, setDelEmail] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delMsg, setDelMsg] = useState(null)

  useEffect(() => {
    getMyProfile(user.id).then((p) => { setProfile(p); setHandleInput(p.handle || ''); setNameInput(p.display_name || '') }).catch((ex) => setMsg({ err: true, text: ex.message }))
  }, [user.id])

  useEffect(() => {
    getIdentityStatus(user.id).then(setIdentity).catch(() => setIdentity(null))
  }, [user.id])

  useEffect(() => {
    listMyGrants().then(setGrants).catch(() => setGrants([]))
  }, [user.id])

  async function saveName() {
    if (!nameInput.trim()) return
    setNBusy(true); setNMsg(null)
    try {
      await updateMyName(user.id, nameInput)
      setProfile((p) => ({ ...p, display_name: nameInput.trim() }))
      setNMsg({ text: t('wbSaved') }); onChanged?.()
    } catch (ex) { setNMsg({ err: true, text: ex.message }) }
    finally { setNBusy(false) }
  }

  async function saveHandle() {
    setHBusy(true); setHMsg(null)
    try {
      const r = await setMyHandle(user.id, handleInput)
      if (r.error) { setHMsg({ err: true, text: t(r.error) }); return }
      setHandleInput(r.handle); setHMsg({ text: t('handleSaved') }); onHandleChanged?.(r.handle)
    } catch (ex) { setHMsg({ err: true, text: ex.message }) }
    finally { setHBusy(false) }
  }

  async function revoke(g) {
    try { await revokeMyGrant(g.client.id); setGrants((l) => l.filter((x) => x.client.id !== g.client.id)) }
    catch (ex) { setMsg({ err: true, text: ex.message }) }
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsg({ err: true, text: t('notImage') }); return }
    if (file.size > 2 * 1024 * 1024) { setMsg({ err: true, text: t('tooBig') }); return }
    setBusy(true); setMsg(null)
    try {
      const url = await uploadAvatar(user.id, file)
      setProfile((p) => ({ ...p, avatar_url: url })); onChanged?.(url)
      setMsg({ text: t('avatarUpdated') })
    } catch (ex) { setMsg({ err: true, text: ex.message }) }
    finally { setBusy(false); e.target.value = '' }
  }

  async function remove() {
    setBusy(true); setMsg(null)
    try {
      await removeAvatar(user.id)
      setProfile((p) => ({ ...p, avatar_url: null })); onChanged?.(null)
      setMsg({ text: t('avatarRemoved') })
    } catch (ex) { setMsg({ err: true, text: ex.message }) }
    finally { setBusy(false) }
  }

  const name = profile?.display_name
  const email = profile?.email || user.email

  // The e-mail typed by the user is the confirmation. On success the session is closed and the visitor lands on the home page.
  const deleteAccount = async () => {
    setDelBusy(true); setDelMsg(null)
    try {
      await deleteMyAccount(delEmail.trim())
      await supabase.auth.signOut().catch(() => {})
      window.location.hash = ''
      window.location.reload()
    } catch (ex) {
      setDelMsg({ err: true, text: t(ex.message === 'confirmation_mismatch' ? 'delAccMismatch' : 'delAccError') })
      setDelBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl space-y-5"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-neutral-900">{t('profile')}</h3>

        <div className="flex items-center gap-4">
          <Avatar name={name} email={email} url={profile?.avatar_url} size="h-20 w-20" text="text-2xl" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-900">{name || email}</p>
            <p className="truncate text-xs text-neutral-500">{email}</p>
            {identity?.status === 'verified' && <VerifiedBadge className="mt-1.5" />}
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => fileRef.current?.click()}
            className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">
            {busy ? '…' : t('changePhoto')}
          </button>
          {profile?.avatar_url && (
            <button disabled={busy} onClick={remove}
              className="flex-1 py-2 rounded-xl bg-neutral-100 text-neutral-900 text-sm disabled:opacity-50">
              {t('removePhoto')}
            </button>
          )}
        </div>

        <section className="space-y-2">
          <label htmlFor="name-input" className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('name')}</label>
          <div className="flex items-center gap-2">
            <input id="name-input" value={nameInput} maxLength={80} onChange={(e) => setNameInput(e.target.value)}
              className="flex-1 min-w-0 rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900" />
            <button type="button" onClick={saveName} disabled={nBusy || !nameInput.trim()}
              className="shrink-0 px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('save')}</button>
          </div>
          <p className="text-xs text-neutral-500">{t('profileNameHint')}</p>
          {nMsg && <p className={`text-xs ${nMsg.err ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>{nMsg.text}</p>}
        </section>

        <section className="space-y-2">
          <label htmlFor="handle-input" className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('handleLabel')}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500" aria-hidden="true">@</span>
            <input id="handle-input" value={handleInput} maxLength={20} onChange={(e) => setHandleInput(e.target.value)}
              className="flex-1 min-w-0 rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900" />
            <button type="button" onClick={saveHandle} disabled={hBusy}
              className="shrink-0 px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('save')}</button>
          </div>
          <p className="text-xs text-neutral-500">{t('handleHint')}</p>
          {hMsg && <p className={`text-xs ${hMsg.err ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>{hMsg.text}</p>}
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('connectedApps')}</h4>
          {grants && grants.length === 0 && <p className="text-sm text-neutral-500">{t('noConnectedApps')}</p>}
          <ul className="divide-y divide-neutral-100">
            {(grants || []).map((g) => (
              <li key={g.client.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm text-neutral-900">{g.client.name || t('consentUnknownApp')}</span>
                <button type="button" onClick={() => revoke(g)} className="shrink-0 text-xs text-neutral-700 underline underline-offset-2">{t('revokeAccess')}</button>
              </li>
            ))}
          </ul>
        </section>

        {profile && profile.account_type !== 'minor' && <PlanSection userId={user.id} justSubscribed={justSubscribed} />}

        {profile && profile.account_type !== 'minor' && (
          <section className="space-y-2 border-t border-neutral-100 pt-4">
            <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('delAccTitle')}</h4>
            {!delOpen ? (
              <button type="button" onClick={() => setDelOpen(true)} data-del-open className="text-sm text-neutral-700 underline underline-offset-2">{t('delAccOpen')}</button>
            ) : (
              <div className="space-y-3 rounded-2xl ring-1 ring-neutral-300 p-4">
                <p className="text-sm font-medium text-neutral-900">{t('delAccIntro')}</p>
                <p className="text-xs text-neutral-600">{t('delAccList')}</p>
                <label htmlFor="del-email" className="block text-xs font-medium text-neutral-700">{t('delAccType')}</label>
                <input id="del-email" type="email" autoComplete="off" value={delEmail} onChange={(e) => setDelEmail(e.target.value)} placeholder={email}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900" />
                {delMsg && <p className="text-xs font-medium text-neutral-900">{delMsg.text}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setDelOpen(false); setDelEmail(''); setDelMsg(null) }} disabled={delBusy}
                    className="flex-1 py-2 rounded-xl bg-neutral-100 text-sm disabled:opacity-50">{t('cancel')}</button>
                  <button type="button" onClick={deleteAccount} data-del-confirm
                    disabled={delBusy || delEmail.trim().toLowerCase() !== String(email || '').toLowerCase()}
                    className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-40">{delBusy ? t('delAccWorking') : t('delAccConfirm')}</button>
                </div>
              </div>
            )}
          </section>
        )}

        {msg && <p className={`text-sm ${msg.err ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>{msg.text}</p>}
        <button onClick={onClose} className="w-full py-2 rounded-xl bg-neutral-100 text-sm">{t('close')}</button>
      </div>
    </div>
  )
}
