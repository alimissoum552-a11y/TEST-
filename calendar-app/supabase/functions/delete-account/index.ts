// Self-service account deletion (GDPR erasure). The signed-in adult deletes their own account:
// - their calendars, with events, chat, members and managed minor profiles (the database cascades),
// - the technical sign-in accounts of the minors of those calendars,
// - their profile photo files,
// - their sign-in account, which removes the rest of their data (profile, messages, memberships, passkeys, verification).
// A minor cannot delete their account here: the adult who owns the team removes the profile (team-admin).
// The confirmation must be the account's own e-mail address, typed by the user. The user's JWT is checked inside the function.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const typed = typeof body?.confirm_email === 'string' ? body.confirm_email.trim().toLowerCase() : ''
    if (!user.email || typed !== user.email.toLowerCase()) return json({ error: 'confirmation_mismatch' }, 400)

    const { data: me } = await admin.from('profiles').select('account_type').eq('id', user.id).maybeSingle()
    if (me?.account_type === 'minor') return json({ error: 'not_allowed' }, 403)

    // Technical accounts of the minors of the calendars this user owns: collected before the calendars disappear.
    const { data: owned } = await admin.from('calendars').select('id').eq('owner_id', user.id)
    const calendarIds = (owned ?? []).map((c: any) => c.id)
    let minorIds: string[] = []
    if (calendarIds.length) {
      const { data: profs } = await admin.from('managed_profiles').select('auth_user_id')
        .in('calendar_id', calendarIds).not('auth_user_id', 'is', null)
      minorIds = (profs ?? []).map((p: any) => p.auth_user_id)
    }

    // Profile photos: avatars/<uid>/...
    const { data: files } = await admin.storage.from('avatars').list(user.id, { limit: 1000 })
    if (files?.length) await admin.storage.from('avatars').remove(files.map((f: any) => `${user.id}/${f.name}`))

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) return json({ error: 'server_error' }, 500)

    // The database trigger already removed these accounts with their managed profiles; this makes sure.
    for (const id of minorIds) await admin.auth.admin.deleteUser(id)

    return json({ ok: true })
  } catch (_e) {
    return json({ error: 'server_error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
