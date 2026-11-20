// Owner-only removal actions that need the server (docs/MINOR_APP.md):
// - remove_profile: removes a managed minor profile AND deletes the technical account of that minor
//   (so the minor can no longer sign in, and their messages go with it).
// - delete_calendar: deletes a calendar with its events, chat, members and minor profiles, and deletes the technical
//   accounts of its minors first. The personal (default) calendar cannot be deleted.
// Both check that the caller owns the calendar. Deployed with the user's JWT checked inside the function.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { reportError } from '../_shared/ops.ts'
import { stepUpSatisfied } from '../_shared/stepup.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const UUID = /^[0-9a-f-]{36}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const body = await req.json().catch(() => ({}))
    // Both actions change a team or a minor's access: they are privileged, not data reads.
    if (!(await stepUpSatisfied(admin, req, user.id))) return json({ error: 'stepup_required' }, 403)
    if (body?.action === 'remove_profile') return await removeProfile(admin, user.id, String(body.profile_id ?? ''))
    if (body?.action === 'delete_calendar') return await deleteCalendar(admin, user.id, String(body.calendar_id ?? ''))
    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    await reportError('team-admin', e)
    return json({ error: 'server_error' }, 500)
  }
})

async function removeProfile(admin: any, userId: string, profileId: string): Promise<Response> {
  if (!UUID.test(profileId)) return json({ error: 'invalid_profile' }, 400)
  const { data: prof } = await admin.from('managed_profiles')
    .select('id, auth_user_id, calendars(owner_id)').eq('id', profileId).maybeSingle()
  if (!prof || prof.calendars?.owner_id !== userId) return json({ error: 'not_allowed' }, 403)

  // The technical account goes first: its profile, membership and messages are deleted with it.
  if (prof.auth_user_id) {
    const { error } = await admin.auth.admin.deleteUser(prof.auth_user_id)
    if (error) return json({ error: 'server_error' }, 500)
  }
  const { error: delErr } = await admin.from('managed_profiles').delete().eq('id', profileId)
  if (delErr) return json({ error: 'server_error' }, 500)
  return json({ ok: true })
}

async function deleteCalendar(admin: any, userId: string, calendarId: string): Promise<Response> {
  if (!UUID.test(calendarId)) return json({ error: 'invalid_calendar' }, 400)
  const { data: cal } = await admin.from('calendars').select('id, owner_id, is_default').eq('id', calendarId).maybeSingle()
  if (!cal || cal.owner_id !== userId) return json({ error: 'not_allowed' }, 403)
  if (cal.is_default) return json({ error: 'default_calendar' }, 409)

  // Delete the minors' technical accounts first. If one fails, nothing else is deleted.
  const { data: minors } = await admin.from('managed_profiles').select('auth_user_id')
    .eq('calendar_id', calendarId).not('auth_user_id', 'is', null)
  for (const m of minors ?? []) {
    const { error } = await admin.auth.admin.deleteUser(m.auth_user_id)
    if (error) return json({ error: 'server_error' }, 500)
  }
  const { error: delErr } = await admin.from('calendars').delete().eq('id', calendarId)
  if (delErr) return json({ error: 'server_error' }, 500)
  // The event history has no foreign key and deleting the events writes new rows: remove them after the calendar.
  await admin.from('event_history').delete().eq('calendar_id', calendarId)
  return json({ ok: true })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
