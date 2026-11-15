import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { listMembers, inviteMember, setMemberRole, removeMember } from './lib/api.js'

const ROLES = ['administrator', 'contributor', 'reader']

export default function SharePanel({ calendarId, currentUserId, onClose }) {
  const { t } = useI18n()
  const [members, setMembers] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('reader')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const input = 'rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900'

  async function refresh() {
    try { setMembers(await listMembers(calendarId)) } catch (ex) { setMsg({ err: true, text: ex.message }) }
  }
  useEffect(() => { refresh() }, [calendarId])

  async function invite(e) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      await inviteMember(calendarId, email.trim(), role)
      setEmail(''); setMsg({ text: t('invited') }); await refresh()
    } catch (ex) {
      setMsg({ err: true, text: ex.message === 'NO_USER' ? t('noUser') : ex.message })
    } finally { setBusy(false) }
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

        <form onSubmit={invite} className="flex flex-col gap-2">
          <input type="email" required className={input} placeholder={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex gap-2">
            <select className={input + ' flex-1'} value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
            </select>
            <button disabled={busy} className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('invite')}</button>
          </div>
        </form>

        {msg && <p className={`text-sm ${msg.err ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>{msg.text}</p>}

        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-neutral-800">
                {m.profiles?.display_name || m.profiles?.email}
              </span>
              <span className="flex items-center gap-2">
                <select className="rounded-lg border border-neutral-200 px-2 py-1 text-xs" value={m.role}
                  onChange={(e) => changeRole(m.user_id, e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                </select>
                <button onClick={() => remove(m.user_id)} className="text-xs text-neutral-500 hover:text-neutral-900">{t('remove')}</button>
              </span>
            </li>
          ))}
          {members.length === 0 && <li className="text-sm text-neutral-500">{t('noMembers')}</li>}
        </ul>

        <button onClick={onClose} className="w-full py-2 rounded-xl bg-neutral-100 text-sm">{t('close')}</button>
      </div>
    </div>
  )
}
