import { useEffect, useState } from 'react'
import { acceptInvite, getInviteById, isMemberOf } from './lib/api.js'
import { supabase } from './lib/supabase.js'
import { useI18n } from './i18n/index.jsx'

// Opened from the invitation e-mail (#/join?invite=<id>), or after sign-in when an invitation is still pending.
// Joining happens only on the account whose e-mail matches the invitation. The server enforces this too.
//
// States: working | joined | already | used | mismatch
export default function JoinPage({ inviteId, user, onJoined, onDone }) {
  const { t } = useI18n()
  const [state, setState] = useState('working')
  const [calendarId, setCalendarId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const inv = await getInviteById(inviteId)
        const myEmail = (user?.email || '').toLowerCase()
        // Not visible, or addressed to another e-mail: this session is the wrong account.
        if (!inv || inv.invitee_email !== myEmail) {
          if (!cancelled) setState('mismatch')
          return
        }
        if (inv.status === 'pending') {
          await acceptInvite(inviteId)
          if (!cancelled) { setCalendarId(inv.calendar_id); setState('joined'); onJoined?.(inv.calendar_id) }
          return
        }
        // Already answered. If the membership exists, the user is in: open that calendar.
        // Otherwise the invitation was declined or accepted without a membership, and a new one is needed.
        const member = inv.status === 'accepted' && await isMemberOf(inv.calendar_id, user.id)
        if (!cancelled) {
          setCalendarId(inv.calendar_id)
          setState(member ? 'already' : 'used')
          if (member) onJoined?.(inv.calendar_id)
        }
      } catch (ex) {
        if (!cancelled) { setErr(ex.message || t('joinFailed')); setState('used') }
      }
    })()
    return () => { cancelled = true }
  }, [inviteId, user?.id])

  // Sign out, then the pending invitation waits on the sign-in screen and resumes after sign-in with the right address.
  async function switchAccount() {
    setBusy(true)
    await supabase.auth.signOut()
  }

  const button = 'w-full py-2.5 rounded-xl text-sm disabled:opacity-50'

  return (
    <div className="min-h-screen bg-neutral-200 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-4 text-center">
        {state === 'working' && <p className="text-sm text-neutral-600">{t('joining')}</p>}

        {state === 'joined' && (
          <>
            <p className="text-base font-semibold text-neutral-900">{t('joinedTitle')}</p>
            <p className="text-sm text-neutral-600">{t('joinedText')}</p>
            <p className="text-xs text-neutral-500">{t('aiNotice')}</p>
            <button onClick={() => onDone?.(calendarId)} className={`${button} bg-neutral-900 text-white`}>{t('openCalendar')}</button>
          </>
        )}

        {state === 'already' && (
          <>
            <p className="text-sm font-medium text-neutral-900">{t('joinAlready')}</p>
            <button onClick={() => onDone?.(calendarId)} className={`${button} bg-neutral-900 text-white`}>{t('openCalendar')}</button>
          </>
        )}

        {state === 'used' && (
          <>
            <p className="text-sm font-medium text-neutral-900">{err || t('joinUsed')}</p>
            <button onClick={() => onDone?.(null)} className={`${button} bg-neutral-100 text-neutral-900`}>{t('openCalendar')}</button>
          </>
        )}

        {state === 'mismatch' && (
          <>
            <p className="text-sm font-medium text-neutral-900">{t('joinForOther')}</p>
            <p className="text-xs text-neutral-500 break-all">{user?.email}</p>
            <button onClick={switchAccount} disabled={busy} className={`${button} bg-neutral-900 text-white`}>{t('joinSwitch')}</button>
            <button onClick={() => onDone?.(null)} disabled={busy} className={`${button} bg-neutral-100 text-neutral-900`}>{t('joinIgnore')}</button>
          </>
        )}
      </div>
    </div>
  )
}
