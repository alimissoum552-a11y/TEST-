import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { listMembers, listCalendarInvites, inviteMember, setMemberRole, removeMember, sendInviteEmail, cancelInvite } from './lib/api.js'
import PlanLimitNote, { planLimitCode } from './PlanLimitNote.jsx'

const ROLES = ['administrator', 'contributor', 'reader']

export default function SharePanel({ calendarId, canManage = false, onClose }) {
  const { t } = useI18n()
  const [members, setMembers] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('reader')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [limit, setLimit] = useState(null)
  const [pending, setPending] = useState([])
  const input = 'rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900'

  async function refresh() {
    try {
      setMembers(await listMembers(calendarId))
      setPending(await listCalendarInvites(calendarId))
    } catch (ex) { setMsg({ err: true, text: ex.message }) }
  }
  useEffect(() => { refresh() }, [calendarId])

  async function invite(e) {
    e.preventDefault(); setBusy(true); setMsg(null); setLimit(null)
    try {
      const inviteId = await inviteMember(calendarId, email.trim(), role)
      // Notify the invitee by email; a mail failure does not undo the membership.
      try {
        await sendInviteEmail(calendarId, email.trim(), role, inviteId)
        setEmail(''); setMsg({ text: t('invitedSent') })
      } catch (ex) {
        // The invite exists (pending). Show why the e-mail did not go out.
        setEmail(''); setMsg({ err: true, text: `${t('invitedNoMail')} ${ex.message || ''}`.trim() })
      }
      await refresh()
    } catch (ex) {
      const code = planLimitCode(ex.message)
      if (code) setLimit(code)
      else setMsg({ err: true, text: ex.message === 'NO_USER' ? t('noUser') : ex.message })
    } finally { setBusy(false) }
  }

  async function cancel(id) {
    try {
      await cancelInvite(id)
      setMsg({ text: t('inviteCancelled') })
      await refresh()
    } catch (ex) { setMsg({ err: true, text: ex.message }) }
  }

  async function changeRole(userId, newRole) {
    try { await setMemberRole(calendarId, userId, newRole); await refresh() }
    catch (ex) { setMsg({ err: true, text: ex.message }) }
  }

  async function remove(userId) {
    try { await removeMember(calendarId, userId); await refresh() }
    catch (ex) { setMsg({ err: true, text: ex.message }) }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl space-y-5 max-h-[90%] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-neutral-900">{t('share')}</h3>

        {canManage ? (
        <form onSubmit={invite} className="flex flex-col gap-2">
          <input type="email" required className={input} placeholder={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex gap-2">
            <select className={input + ' flex-1'} value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
            </select>
            <button disabled={busy} className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('invite')}</button>
          </div>
        </form>
        ) : (
          <p className="text-sm text-neutral-500">{t('readOnly')}</p>
        )}

        {msg && <p className={`text-sm ${msg.err ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>{msg.text}</p>}
        <PlanLimitNote code={limit} />

        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-neutral-800">
                {m.profiles?.display_name || m.profiles?.email}
              </span>
              <span className="flex items-center gap-2">
                {canManage ? (
                  <>
                    <select className="rounded-lg border border-neutral-200 px-2 py-1 text-xs" value={m.role}
                      onChange={(e) => changeRole(m.user_id, e.target.value)}>
                      {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                    </select>
                    <button onClick={() => remove(m.user_id)} className="text-xs text-neutral-500 hover:text-neutral-900">{t('remove')}</button>
                  </>
                ) : (
                  <span className="text-xs text-neutral-500">{t(m.role)}</span>
                )}
              </span>
            </li>
          ))}
          {members.length === 0 && pending.length === 0 && <li className="text-sm text-neutral-500">{t('noMembers')}</li>}
          {pending.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-neutral-500">{i.invitee_email}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-xs text-neutral-500">{t('pending')}</span>
                {canManage && <button onClick={() => cancel(i.id)} aria-label={`${t('cancelInvite')} ${i.invitee_email}`}
                  className="text-xs text-neutral-500 hover:text-neutral-900">{t('cancelInvite')}</button>}
              </span>
            </li>
          ))}
        </ul>

        <button onClick={onClose} className="w-full py-2 rounded-xl bg-neutral-100 text-sm">{t('close')}</button>
      </div>
    </div>
  )
}
