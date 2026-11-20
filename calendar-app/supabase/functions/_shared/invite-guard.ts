// Who may trigger an invitation e-mail, and for which invitation.
// Used by the send-invite Edge Function before it calls the mail provider.
export type InviteRow = {
  calendar_id?: string | null
  invitee_email?: string | null
  role?: string | null
  status?: string | null
}

export type InviteCheck =
  | { ok: true }
  | { ok: false; reason: 'not_manager' | 'no_invite' | 'wrong_calendar' | 'wrong_email' | 'wrong_role' | 'not_pending' }

export function canSendInvite(input: {
  isOwner: boolean
  callerRole: string | null
  calendarId: string
  email: string
  role: string
  invite: InviteRow | null | undefined
}): InviteCheck {
  if (!input.isOwner && input.callerRole !== 'administrator') return { ok: false, reason: 'not_manager' }
  const i = input.invite
  if (!i) return { ok: false, reason: 'no_invite' }
  if (i.calendar_id !== input.calendarId) return { ok: false, reason: 'wrong_calendar' }
  if ((i.invitee_email ?? '').trim().toLowerCase() !== input.email.trim().toLowerCase()) return { ok: false, reason: 'wrong_email' }
  if (i.role !== input.role) return { ok: false, reason: 'wrong_role' }
  if (i.status !== 'pending') return { ok: false, reason: 'not_pending' }
  return { ok: true }
}
