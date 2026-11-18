// Access of a minor to a team calendar (docs/MINOR_APP.md).
// - create / regenerate / disable: the adult owner of the calendar (user session). The identifier is shown once.
// - login: no session. The minor gives the e-mail of the team owner and the identifier. The answer is a token the
//   app exchanges for a normal session limited to the minor role. Every failure looks the same.
// Deployed with --no-verify-jwt (login has no session); the other actions check the session themselves.
// Secrets: MINOR_ID_SECRET. Provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  generateAccessId, formatAccessId, normalizeAccessId, isValidAccessIdShape, hmacHex, tooManyAttempts, WINDOW_MINUTES,
} from '../_shared/access.ts'
import { reportError } from '../_shared/ops.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const secret = Deno.env.get('MINOR_ID_SECRET')
    if (!secret) return json({ error: 'minor_access_not_configured' }, 503)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json().catch(() => ({}))

    if (body?.action === 'login') return await login(req, admin, secret, body)
    if (['create', 'regenerate', 'disable'].includes(body?.action)) return await manage(req, admin, secret, body)
    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    await reportError('minor-access', e)
    return json({ error: 'server_error' }, 500)
  }
})

// ---------- adult owner: create, regenerate, disable ----------
async function manage(req: Request, admin: any, secret: string, body: any): Promise<Response> {
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  const profileId = typeof body.profile_id === 'string' ? body.profile_id : ''
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return json({ error: 'invalid_profile' }, 400)

  const { data: prof } = await admin.from('managed_profiles')
    .select('id, calendar_id, first_name, status, auth_user_id, calendars(owner_id, name)').eq('id', profileId).maybeSingle()
  if (!prof || prof.calendars?.owner_id !== user.id) return json({ error: 'not_allowed' }, 403)
  if (prof.status !== 'active') return json({ error: 'profile_not_active' }, 409)

  if (body.action === 'disable') {
    if (!prof.auth_user_id) return json({ error: 'no_access' }, 409)
    await admin.from('managed_profiles').update({ access_disabled: true }).eq('id', profileId)
    await admin.auth.admin.updateUserById(prof.auth_user_id, { ban_duration: '876000h' })
    return json({ ok: true })
  }

  if (body.action === 'create') {
    if (prof.auth_user_id) return json({ error: 'already_created' }, 409)
    // The signed declaration must cover the access.
    const { data: decl } = await admin.from('declarations').select('id')
      .eq('profile_id', profileId).contains('functions', ['access']).limit(1)
    if (!decl?.length) return json({ error: 'declaration_missing_access' }, 403)

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: `m-${crypto.randomUUID()}@minor.collyo.app`,
      email_confirm: true,
      user_metadata: { account_type: 'minor', display_name: prof.first_name },
    })
    if (cErr || !created?.user) return json({ error: 'server_error' }, 500)
    const minorId = created.user.id
    const { error: mErr } = await admin.from('calendar_members').insert({ calendar_id: prof.calendar_id, user_id: minorId, role: 'minor' })
    if (mErr) { await admin.auth.admin.deleteUser(minorId); return json({ error: 'server_error' }, 500) }

    const issued = await issueIdentifier(admin, secret, profileId, { auth_user_id: minorId, access_created_at: new Date().toISOString() })
    if (!issued) return json({ error: 'server_error' }, 500)
    return json({ ok: true, access_id: formatAccessId(issued), team_name: prof.calendars?.name })
  }

  // regenerate: the old identifier stops working at once; a disabled access is switched on again.
  if (!prof.auth_user_id) return json({ error: 'no_access' }, 409)
  const issued = await issueIdentifier(admin, secret, profileId, { access_disabled: false })
  if (!issued) return json({ error: 'server_error' }, 500)
  await admin.auth.admin.updateUserById(prof.auth_user_id, { ban_duration: 'none' })
  return json({ ok: true, access_id: formatAccessId(issued), team_name: prof.calendars?.name })
}

// Generates an identifier and stores only its hash. A clash on the unique hash (very unlikely) retries.
async function issueIdentifier(admin: any, secret: string, profileId: string, extra: Record<string, unknown>): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = generateAccessId()
    const hash = await hmacHex('access:' + id, secret)
    const { error } = await admin.from('managed_profiles').update({ ...extra, access_id_hash: hash }).eq('id', profileId)
    if (!error) return id
  }
  return null
}

// ---------- minor: login ----------
async function login(req: Request, admin: any, secret: string, body: any): Promise<Response> {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const id = normalizeAccessId(body.id)
  const address = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
  const addressKey = await hmacHex('ip:' + address, secret)
  const idKey = await hmacHex('id:' + id, secret)

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()
  const count = async (key: string) => {
    const { count: n } = await admin.from('minor_login_attempts').select('id', { count: 'exact', head: true })
      .eq('key_hash', key).gte('created_at', since)
    return n ?? 0
  }
  if (tooManyAttempts(await count(idKey), await count(addressKey))) return json({ error: 'too_many_attempts' }, 429)

  const fail = async () => {
    await admin.from('minor_login_attempts').insert([{ key_hash: idKey }, { key_hash: addressKey }])
    return json({ error: 'invalid_access' }, 401)
  }

  if (!email || !isValidAccessIdShape(id)) return await fail()

  const { data: prof } = await admin.from('managed_profiles')
    .select('first_name, status, access_disabled, auth_user_id, calendars(owner_id, name)')
    .eq('access_id_hash', await hmacHex('access:' + id, secret)).maybeSingle()
  if (!prof || prof.status !== 'active' || prof.access_disabled || !prof.auth_user_id) return await fail()

  // The e-mail must be the one of the team owner.
  const { data: owner } = await admin.auth.admin.getUserById(prof.calendars?.owner_id)
  if (String(owner?.user?.email ?? '').toLowerCase() !== email) return await fail()

  const { data: minorUser } = await admin.auth.admin.getUserById(prof.auth_user_id)
  if (!minorUser?.user?.email) return await fail()
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: minorUser.user.email })
  if (error || !link?.properties?.hashed_token) return json({ error: 'session_failed' }, 500)

  return json({ token_hash: link.properties.hashed_token, first_name: prof.first_name, team_name: prof.calendars?.name })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
