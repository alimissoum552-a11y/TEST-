import { useEffect, useRef, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import Avatar from './Avatar.jsx'
import { getMyProfile, uploadAvatar, removeAvatar, listMyGrants, revokeMyGrant, setMyHandle } from './lib/api.js'

// Lets the user see their avatar, change it to a photo, or remove it.
export default function ProfilePanel({ user, onClose, onChanged, onHandleChanged }) {
  const { t } = useI18n()
  const [profile, setProfile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)
  const [grants, setGrants] = useState(null)
  const [handleInput, setHandleInput] = useState('')
  const [hBusy, setHBusy] = useState(false)
  const [hMsg, setHMsg] = useState(null)

  useEffect(() => {
    getMyProfile(user.id).then((p) => { setProfile(p); setHandleInput(p.handle || '') }).catch((ex) => setMsg({ err: true, text: ex.message }))
  }, [user.id])

  useEffect(() => {
    listMyGrants().then(setGrants).catch(() => setGrants([]))
  }, [user.id])

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

  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl space-y-5"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-neutral-900">{t('profile')}</h3>

        <div className="flex items-center gap-4">
          <Avatar name={name} email={email} url={profile?.avatar_url} size="h-20 w-20" text="text-2xl" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-900">{name || email}</p>
            <p className="truncate text-xs text-neutral-500">{email}</p>
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

        {msg && <p className={`text-sm ${msg.err ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>{msg.text}</p>}
        <button onClick={onClose} className="w-full py-2 rounded-xl bg-neutral-100 text-sm">{t('close')}</button>
      </div>
    </div>
  )
}
