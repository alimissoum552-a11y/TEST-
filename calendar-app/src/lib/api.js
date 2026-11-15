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

// Looks up a user by exact email (admins only, enforced in SQL) and adds them.
export async function inviteMember(calendarId, email, role) {
  const { data: found, error: findErr } = await supabase
    .rpc('find_user_for_share', { cal: calendarId, target_email: email })
  if (findErr) throw findErr
  const target = found?.[0]
  if (!target) throw new Error('NO_USER')
  const { error } = await supabase
    .from('calendar_members')
    .upsert({ calendar_id: calendarId, user_id: target.user_id, role })
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
export async function sendInviteEmail(calendarId, email, role) {
  const { data, error } = await supabase.functions.invoke('send-invite', {
    body: { calendar_id: calendarId, email, role },
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
