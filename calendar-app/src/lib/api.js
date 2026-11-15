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
