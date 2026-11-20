import { describe, it, expect } from 'vitest'
import { canSendInvite, type InviteRow } from './invite-guard.ts'

const invite: InviteRow = { calendar_id: 'cal-1', invitee_email: 'a@example.com', role: 'reader', status: 'pending' }
const base = { isOwner: true, callerRole: null, calendarId: 'cal-1', email: 'a@example.com', role: 'reader', invite }

describe('canSendInvite', () => {
  it('lets the owner and an administrator send a matching pending invite', () => {
    expect(canSendInvite(base)).toEqual({ ok: true })
    expect(canSendInvite({ ...base, isOwner: false, callerRole: 'administrator' })).toEqual({ ok: true })
  })

  it('refuses a contributor, a reader and a non-member', () => {
    for (const role of ['contributor', 'reader', 'minor', null]) {
      expect(canSendInvite({ ...base, isOwner: false, callerRole: role })).toEqual({ ok: false, reason: 'not_manager' })
    }
  })

  it('refuses a missing invite or a mismatch with the request', () => {
    expect(canSendInvite({ ...base, invite: null })).toEqual({ ok: false, reason: 'no_invite' })
    expect(canSendInvite({ ...base, invite: { ...invite, calendar_id: 'cal-2' } }).ok).toBe(false)
    expect(canSendInvite({ ...base, email: 'b@example.com' }).ok).toBe(false)
    expect(canSendInvite({ ...base, role: 'administrator' }).ok).toBe(false)
    expect(canSendInvite({ ...base, invite: { ...invite, status: 'accepted' } }).ok).toBe(false)
  })

  it('compares e-mails case-insensitively and trims', () => {
    expect(canSendInvite({ ...base, email: '  A@Example.COM ' })).toEqual({ ok: true })
  })
})
