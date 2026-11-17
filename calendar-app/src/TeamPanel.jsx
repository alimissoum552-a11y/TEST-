import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { listMembers, getProfile, removeMember, deleteCalendar } from './lib/api.js'
import { TeamWellbeingSettings } from './TeamWellbeing.jsx'
import FamilyPanel from './FamilyPanel.jsx'

// Read-only list of the calendar's team members and their roles.
export default function TeamPanel({ calendar, calendarId, ownerId, userId, isOwner = false, onClose, onDeleted }) {
  const { t } = useI18n()
  const [members, setMembers] = useState(null)
  const [err, setErr] = useState(null)
  const [owner, setOwner] = useState(null)
  const ownerRow = owner ? (owner.display_name || owner.email) : null
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [delText, setDelText] = useState('')

  // Owner only: remove an adult member (a minor is removed from the family panel, with their account).
  async function removeAdult(m) {
    setBusy(true); setErr(null)
    try {
      await removeMember(calendarId, m.user_id)
      setMembers((list) => (list || []).filter((x) => x.user_id !== m.user_id))
      setConfirmId(null)
    } catch (ex) { setErr(t('famErrGeneric')) } finally { setBusy(false) }
  }

  async function deleteThisCalendar() {
    setBusy(true); setErr(null)
    try {
      await deleteCalendar(calendarId)
      onDeleted?.()
    } catch (ex) { setErr(ex.message === 'default_calendar' ? t('tmDeleteDefault') : t('famErrGeneric')) }
    finally { setBusy(false) }
  }

  useEffect(() => {
    if (ownerId) getProfile(ownerId).then(setOwner).catch(() => {})
    listMembers(calendarId)
      .then((rows) => setMembers(rows))
      .catch((ex) => setErr(ex.message))
  }, [calendarId, ownerId])

  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl space-y-4 max-h-[90%] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-neutral-900">{t('team')}</h3>
        <p className="text-xs text-neutral-500">{t('aiNotice')}</p>

        {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
        {members === null && !err && <p className="text-sm text-neutral-400">…</p>}
        {members && members.length === 0 && <p className="text-sm text-neutral-500">{t('noMembers')}</p>}

        <FamilyPanel calendar={calendar || { id: calendarId, kind: 'work' }} userId={userId} isOwner={isOwner} />

        <TeamWellbeingSettings calendarId={calendarId} userId={userId} isOwner={isOwner} />

        <ul className="divide-y divide-neutral-100">
          {ownerRow && (
            <li className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0 truncate text-sm text-neutral-900">{ownerRow}</span>
              <span className="shrink-0 rounded-full bg-neutral-900 px-3 py-1 text-xs text-white">{t('owner')}</span>
            </li>
          )}
          {(members || []).map((m) => {
            const label = m.profiles?.display_name || m.profiles?.email || ''
            return (
              <li key={m.user_id} className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-neutral-900">{label}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">{t(m.role)}</span>
                    {isOwner && m.role !== 'minor' && confirmId !== m.user_id && (
                      <button type="button" onClick={() => { setConfirmId(m.user_id); setErr(null) }}
                        className="text-xs text-neutral-500 hover:text-neutral-900">{t('remove')}</button>
                    )}
                  </span>
                </div>
                {isOwner && confirmId === m.user_id && (
                  <div className="rounded-xl bg-neutral-50 p-3 space-y-2">
                    <p className="text-xs text-neutral-700">{t('tmRemoveConfirm').replace('{name}', label)}</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmId(null)} className="flex-1 py-2 rounded-xl bg-neutral-100 text-xs">{t('cancel')}</button>
                      <button type="button" onClick={() => removeAdult(m)} disabled={busy}
                        className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">{t('tmConfirm')}</button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {isOwner && calendar && (
          <section className="rounded-2xl border border-neutral-300 p-4 space-y-3">
            <p className="text-sm font-semibold text-neutral-900">{t('tmDeleteTitle')}</p>
            {calendar.is_default ? (
              <p className="text-xs text-neutral-500">{t('tmDeleteDefault')}</p>
            ) : !delOpen ? (
              <button type="button" onClick={() => setDelOpen(true)} className="text-xs text-neutral-900 underline underline-offset-2">{t('tmDeleteButton')}</button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-neutral-700">{t('tmDeleteWarn')}</p>
                <label htmlFor="del-name" className="block text-xs font-medium text-neutral-900">{t('tmDeleteType')} : <strong>{calendar.name}</strong></label>
                <input id="del-name" value={delText} onChange={(e) => setDelText(e.target.value)} autoComplete="off"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setDelOpen(false); setDelText('') }} className="flex-1 py-2 rounded-xl bg-neutral-100 text-xs">{t('cancel')}</button>
                  <button type="button" onClick={deleteThisCalendar} disabled={busy || delText.trim() !== (calendar.name || '').trim()}
                    className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">{t('tmDeleteButton')}</button>
                </div>
              </div>
            )}
          </section>
        )}

        <button onClick={onClose} className="w-full py-2 rounded-xl bg-neutral-100 text-sm">{t('close')}</button>
      </div>
    </div>
  )
}
