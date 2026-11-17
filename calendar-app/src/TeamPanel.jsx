import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { listMembers, getProfile } from './lib/api.js'
import { TeamWellbeingSettings } from './TeamWellbeing.jsx'
import FamilyPanel from './FamilyPanel.jsx'

// Read-only list of the calendar's team members and their roles.
export default function TeamPanel({ calendar, calendarId, ownerId, userId, isOwner = false, onClose }) {
  const { t } = useI18n()
  const [members, setMembers] = useState(null)
  const [err, setErr] = useState(null)
  const [owner, setOwner] = useState(null)
  const ownerRow = owner ? (owner.display_name || owner.email) : null

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
          {(members || []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0 truncate text-sm text-neutral-900">
                {m.profiles?.display_name || m.profiles?.email}
              </span>
              <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                {t(m.role)}
              </span>
            </li>
          ))}
        </ul>

        <button onClick={onClose} className="w-full py-2 rounded-xl bg-neutral-100 text-sm">{t('close')}</button>
      </div>
    </div>
  )
}
