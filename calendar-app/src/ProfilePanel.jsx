import { useEffect, useRef, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import Avatar from './Avatar.jsx'
import { getMyProfile, uploadAvatar, removeAvatar } from './lib/api.js'

// Lets the user see their avatar, change it to a photo, or remove it.
export default function ProfilePanel({ user, onClose, onChanged }) {
  const { t } = useI18n()
  const [profile, setProfile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    getMyProfile(user.id).then(setProfile).catch((ex) => setMsg({ err: true, text: ex.message }))
  }, [user.id])

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

        {msg && <p className={`text-sm ${msg.err ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>{msg.text}</p>}
        <button onClick={onClose} className="w-full py-2 rounded-xl bg-neutral-100 text-sm">{t('close')}</button>
      </div>
    </div>
  )
}
