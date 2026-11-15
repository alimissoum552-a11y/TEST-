import { useEffect, useState } from 'react'
import { acceptInvite, listMyInvites } from './lib/api.js'
import { useI18n } from './i18n/index.jsx'

// Opened from the invitation e-mail: #/join?invite=<id>.
// Joining is automatic on the invitee's own account. The server refuses it
// for any account whose e-mail does not match the invitation.
export default function JoinPage({ inviteId, onJoined }) {
  const { t } = useI18n()
  const [state, setState] = useState('working') // working | joined | error
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Only pending invites for this account are listed; the link's invite must be one of them.
        const pending = await listMyInvites()
        const mine = pending.find((p) => p.id === inviteId)
        if (!mine) {
          // Already joined, already answered, or not addressed to this account.
          if (!cancelled) { setState('error'); setMessage(t('joinNotForYou')) }
          return
        }
        await acceptInvite(inviteId)
        if (!cancelled) { setState('joined'); onJoined?.(mine.calendar_id) }
      } catch (ex) {
        if (!cancelled) { setState('error'); setMessage(ex.message || t('joinFailed')) }
      }
    })()
    return () => { cancelled = true }
  }, [inviteId])

  return (
    <div className="min-h-screen bg-neutral-200 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-4 text-center">
        {state === 'working' && <p className="text-sm text-neutral-600">{t('joining')}</p>}
        {state === 'joined' && (
          <>
            <p className="text-base font-semibold text-neutral-900">{t('joinedTitle')}</p>
            <p className="text-sm text-neutral-600">{t('joinedText')}</p>
            <button onClick={() => { window.location.hash = '' }}
              className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm">{t('openCalendar')}</button>
          </>
        )}
        {state === 'error' && (
          <>
            <p className="text-sm font-medium text-neutral-900">{message}</p>
            <button onClick={() => { window.location.hash = '' }}
              className="w-full py-2.5 rounded-xl bg-neutral-100 text-neutral-900 text-sm">{t('openCalendar')}</button>
          </>
        )}
      </div>
    </div>
  )
}
