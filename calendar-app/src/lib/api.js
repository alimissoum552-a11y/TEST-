import { supabase } from './supabase.js'

// Fetch the user's default calendar (created automatically by the DB trigger).
export async function getDefaultCalendar(userId) {
  const { data, error } = await supabase
    .from('calendars').select('*').eq('owner_id', userId).eq('is_default', true).single()
  if (error) throw error
  return data
}

export async function listEvents(calendarId) {
  const { data, error } = await supabase
    .from('events').select('*').eq('calendar_id', calendarId).order('starts_at')
  if (error) throw error
  return data
}

export async function createEvent(ev) {
  const { data, error } = await supabase.from('events').insert(ev).select().single()
  if (error) throw error
  return data
}

export async function updateEvent(id, patch) {
  const { data, error } = await supabase.from('events').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}

// Live updates for events of one calendar. Returns an unsubscribe function.
export function subscribeToEvents(calendarId, onChange) {
  const channel = supabase
    .channel(`events:${calendarId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'events', filter: `calendar_id=eq.${calendarId}` },
      (payload) => onChange(payload))
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ---- Sharing ----
export async function listMembers(calendarId) {
  const { data, error } = await supabase
    .from('calendar_members')
    .select('user_id, role, profiles(display_name, email)')
    .eq('calendar_id', calendarId)
  if (error) throw error
  return data
}

// Sends an invitation. The invitee is NOT a member until they accept.
export async function inviteMember(calendarId, email, role) {
  const { data, error } = await supabase
    .rpc('invite_to_calendar', { cal: calendarId, target_email: email, target_role: role })
  if (error) throw error
  return data // invite id, used in the join link
}

// Invites addressed to the signed-in user, waiting for an answer.
export async function listMyInvites() {
  const { data, error } = await supabase.rpc('my_pending_invites')
  if (error) throw error
  return data || []
}

export async function acceptInvite(inviteId) {
  const { error } = await supabase.rpc('accept_invite', { inv: inviteId })
  if (error) throw error
}

export async function declineInvite(inviteId) {
  const { error } = await supabase.rpc('decline_invite', { inv: inviteId })
  if (error) throw error
}

export async function setMemberRole(calendarId, userId, role) {
  const { error } = await supabase
    .from('calendar_members').update({ role }).eq('calendar_id', calendarId).eq('user_id', userId)
  if (error) throw error
}

export async function removeMember(calendarId, userId) {
  const { error } = await supabase
    .from('calendar_members').delete().eq('calendar_id', calendarId).eq('user_id', userId)
  if (error) throw error
}

// ---- History ----
export async function listHistory(eventId) {
  const { data, error } = await supabase
    .from('event_history').select('*').eq('event_id', eventId)
    .order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data
}

export async function restoreVersion(historyId) {
  const { data, error } = await supabase.rpc('restore_event_version', { history_id: historyId })
  if (error) throw error
  return data
}

// Sends the invitation email via the send-invite Edge Function (Resend, server-side).
export async function sendInviteEmail(calendarId, email, role, inviteId) {
  const { data, error } = await supabase.functions.invoke('send-invite', {
    body: { calendar_id: calendarId, email, role, invite_id: inviteId },
  })
  if (error) throw error
  return data
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles').select('display_name, email').eq('id', userId).single()
  if (error) throw error
  return data
}

// ---- Avatars ----
// Uploads a photo to avatars/<uid>/avatar-<ts>.<ext> and stores its public URL on the profile.
export async function uploadAvatar(userId, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage.from('avatars')
    .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })
  if (upErr) throw upErr
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = data.publicUrl
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
  if (error) throw error
  return url
}

export async function removeAvatar(userId) {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
  if (error) throw error
}

export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles').select('display_name, email, avatar_url').eq('id', userId).single()
  if (error) throw error
  return data
}

// All calendars the user can access: their own plus those they are a member of.
export async function listAccessibleCalendars(userId) {
  const { data: own, error: e1 } = await supabase
    .from('calendars').select('id, name, owner_id, is_default').eq('owner_id', userId)
  if (e1) throw e1
  const { data: memberships, error: e2 } = await supabase
    .from('calendar_members').select('calendar_id, role').eq('user_id', userId)
  if (e2) throw e2
  const sharedIds = (memberships || []).map((m) => m.calendar_id).filter((id) => !own.some((c) => c.id === id))
  let shared = []
  if (sharedIds.length) {
    const { data, error } = await supabase
      .from('calendars').select('id, name, owner_id, is_default').in('id', sharedIds)
    if (error) throw error
    // Owner names make shared calendars distinguishable when they share a default name.
    const ownerIds = [...new Set(data.map((c) => c.owner_id))]
    let names = {}
    if (ownerIds.length) {
      const { data: profs } = await supabase
        .from('profiles').select('id, display_name, email').in('id', ownerIds)
      names = Object.fromEntries((profs || []).map((p) => [p.id, p.display_name || p.email]))
    }
    shared = data.map((c) => ({
      ...c,
      my_role: memberships.find((m) => m.calendar_id === c.id)?.role,
      owner_name: names[c.owner_id] || null,
    }))
  }
  return [
    ...own.map((c) => ({ ...c, my_role: 'owner' })),
    ...shared,
  ]
}

// Events across several calendars, each tagged with its calendar id.
export async function listEventsForCalendars(calendarIds) {
  if (!calendarIds.length) return []
  const { data, error } = await supabase
    .from('events').select('*').in('calendar_id', calendarIds).order('starts_at')
  if (error) throw error
  return data
}

// Pending invites for a calendar, shown to its owner/administrators.
export async function listCalendarInvites(calendarId) {
  const { data, error } = await supabase
    .from('calendar_invites')
    .select('id, invitee_email, role, status, created_at')
    .eq('calendar_id', calendarId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Cancels a pending invitation. The join link stops working immediately.
export async function cancelInvite(inviteId) {
  const { error } = await supabase.from('calendar_invites').delete().eq('id', inviteId)
  if (error) throw error
}

// ---- Invitation links ----
// The invitee can read an invitation addressed to their e-mail (RLS). Returns null when it is not visible to this account.
export async function getInviteById(inviteId) {
  const { data, error } = await supabase
    .from('calendar_invites')
    .select('id, calendar_id, invitee_email, role, status')
    .eq('id', inviteId)
    .maybeSingle()
  if (error) throw error
  return data ? { ...data, invitee_email: (data.invitee_email || '').toLowerCase() } : null
}

export async function isMemberOf(calendarId, userId) {
  const { data, error } = await supabase
    .from('calendar_members')
    .select('user_id')
    .eq('calendar_id', calendarId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}
