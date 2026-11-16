import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { listMyInvites, acceptInvite, declineInvite } from './lib/api.js'

// Shows calendar invitations waiting for the user's answer.
// Access is granted only on Accept; Decline grants nothing.
export default function InvitesPanel({ onAnswered }) {
  const { t, locale } = useI18n()
  const [invites, setInvites] = useState([])
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)
  // Closing hides the panel for this session only. Nothing is answered, so nothing changes on the account.
  const [dismissed, setDismissed] = useState(false)

  const load = () => listMyInvites().then(setInvites).catch((ex) => setErr(ex.message))
  useEffect(() => { load() }, [])

  async function answer(inv, accept) {
    setBusy(inv.id); setErr(null)
    try {
      if (accept) await acceptInvite(inv.id); else await declineInvite(inv.id)
      setInvites((l) => l.filter((x) => x.id !== inv.id))
      onAnswered?.(accept ? inv.calendar_id : null)
    } catch (ex) { setErr(ex.message) } finally { setBusy(null) }
  }

  if (dismissed || (!invites.length && !err)) return null

  return (
    <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl space-y-4 max-h-[90%] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-neutral-900">{t('invitesTitle')}</h3>
          <button type="button" onClick={() => setDismissed(true)} className="text-sm text-neutral-500 hover:text-neutral-900">{t('close')}</button>
        </div>
        {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
        <ul className="space-y-3">
          {invites.map((inv) => (
            <li key={inv.id} className="rounded-2xl border border-neutral-200 p-4 space-y-3">
              <p className="text-sm text-neutral-900">
                <strong>{inv.inviter_name || t('someone')}</strong> {t('invitedYouTo')} <strong>{inv.calendar_name}</strong>
              </p>
              <p className="text-xs text-neutral-500">
                {t('asRole')} {t(inv.role)} · {new Date(inv.created_at).toLocaleDateString(locale)}
              </p>
              <div className="flex gap-2">
                <button disabled={busy === inv.id} onClick={() => answer(inv, false)}
                  className="flex-1 py-2 rounded-xl bg-neutral-100 text-neutral-900 text-sm disabled:opacity-50">{t('decline')}</button>
                <button disabled={busy === inv.id} onClick={() => answer(inv, true)}
                  className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('accept')}</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
