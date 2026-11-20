// Guardian consent for a child who may be under 13 (docs/MINOR_APP.md, section 4), and invitation of an adult responsible.
// - invite_guardian: the owner adds an adult responsible by e-mail. They get an e-mail, with or without an account.
// - request: the adult owner enters the guardian's e-mail; an e-mail with an approval link is sent.
// - info and approve: no session. The guardian opens the link, reads what is collected, and approves.
// The link carries a random token; only its hash is stored. It is valid 7 days and works once.
// Deployed with --no-verify-jwt (info and approve have no session); request checks the session itself.
// Secrets: RESEND_API_KEY, INVITE_FROM, INVITE_REPLY_TO, APP_URL. Provided: SUPABASE_* keys.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sha256Hex, consentRequired, validEmail, maskEmail } from '../_shared/access.ts'
import { brandHeader } from '../_shared/brand.ts'
import { reportError } from '../_shared/ops.ts'
import { stepUpSatisfied } from '../_shared/stepup.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const VALID_DAYS = 7

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json().catch(() => ({}))
    if (body?.action === 'request') return await requestConsent(req, admin, body)
    if (body?.action === 'invite_guardian') return await inviteGuardian(req, admin, body)
    if (body?.action === 'info' || body?.action === 'approve') return await useToken(admin, body)
    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    await reportError('minor-consent', e)
    return json({ error: 'server_error' }, 500)
  }
})

async function requestConsent(req: Request, admin: any, body: any): Promise<Response> {
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  if (!(await stepUpSatisfied(admin, req, user.id))) return json({ error: 'stepup_required' }, 403)

  const profileId = typeof body.profile_id === 'string' ? body.profile_id : ''
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return json({ error: 'invalid_profile' }, 400)
  const guardianEmail = typeof body.guardian_email === 'string' ? body.guardian_email.trim().toLowerCase() : ''
  if (!validEmail(guardianEmail)) return json({ error: 'invalid_email' }, 400)

  const { data: prof } = await admin.from('managed_profiles')
    .select('id, first_name, birth_year, sex, category, status, consent_status, calendars(owner_id, name)').eq('id', profileId).maybeSingle()
  if (!prof || prof.calendars?.owner_id !== user.id) return json({ error: 'not_allowed' }, 403)
  if (prof.status !== 'pending') return json({ error: 'profile_not_pending' }, 409)
  if (!consentRequired(prof.birth_year)) return json({ error: 'consent_not_required' }, 409)
  if (prof.consent_status === 'approved') return json({ error: 'already_approved' }, 409)

  // Only the latest link works.
  await admin.from('minor_consents').delete().eq('profile_id', profileId).is('used_at', null)
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)))
  const tokenHash = await sha256Hex(token)
  const { error: insErr } = await admin.from('minor_consents').insert({
    profile_id: profileId, token_hash: tokenHash, guardian_email: guardianEmail,
    expires_at: new Date(Date.now() + VALID_DAYS * 86400_000).toISOString(),
  })
  if (insErr) return json({ error: 'server_error' }, 500)
  await admin.from('managed_profiles').update({
    consent_status: 'pending', guardian_email: guardianEmail, consent_requested_at: new Date().toISOString(),
  }).eq('id', profileId)

  const { data: ownerProfile } = await admin.from('profiles').select('display_name, email').eq('id', user.id).maybeSingle()
  const ownerName = ownerProfile?.display_name || ownerProfile?.email || 'The team owner'
  const appUrl = Deno.env.get('APP_URL') ?? 'https://collyo.app'
  const link = `${appUrl}/#/consent?token=${encodeURIComponent(token)}`
  const from = Deno.env.get('INVITE_FROM') ?? 'Calendar <onboarding@resend.dev>'
  const replyTo = Deno.env.get('INVITE_REPLY_TO') ?? undefined
  const data = [
    `first name (${prof.first_name})`, `year of birth (${prof.birth_year})`,
    ...(prof.sex ? ['sex'] : []), ...(prof.category ? [`category (${prof.category})`] : []),
  ].join(', ')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [guardianEmail], ...(replyTo ? { reply_to: replyTo } : {}),
      subject: `Your consent is needed: ${prof.first_name} in "${prof.calendars?.name}"`,
      html: `<div style="font-family:system-ui,sans-serif;color:#171717;line-height:1.5">
  ${brandHeader()}
  <p>${escapeHtml(ownerName)} wants to add <strong>${escapeHtml(prof.first_name)}</strong> to the team calendar <strong>${escapeHtml(prof.calendars?.name ?? '')}</strong> on Collyo.</p>
  <p>You are asked to give your consent as the person responsible for this child. Please read before you decide:</p>
  <ul>
    <li>Data kept about the child: ${escapeHtml(data)}.</li>
    <li>The child would see the team calendar (without changing it) and write in the team chat, with the members of this team only.</li>
    <li>You can withdraw your consent and ask for the data to be deleted at any time at support@collyo.app.</li>
  </ul>
  <p><a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:12px;background:#171717;color:#fff;text-decoration:none">Read and approve</a></p>
  <p style="font-size:13px;color:#525252">The link works once and expires in ${VALID_DAYS} days. If you do not know ${escapeHtml(ownerName)} or do not want this, do nothing: nothing will be created.</p>
</div>`,
    }),
  })
  if (!res.ok) return json({ error: 'email_failed' }, 502)
  return json({ ok: true })
}

// The owner adds an adult responsible by e-mail.
// - An account exists: the adult is linked to the profile and added to the team calendar (contributor), and is told by e-mail.
// - No account yet: an invitation is stored and an e-mail asks them to create an account; they are linked when the address is confirmed.
async function inviteGuardian(req: Request, admin: any, body: any): Promise<Response> {
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  if (!(await stepUpSatisfied(admin, req, user.id))) return json({ error: 'stepup_required' }, 403)

  const profileId = typeof body.profile_id === 'string' ? body.profile_id : ''
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return json({ error: 'invalid_profile' }, 400)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!validEmail(email) || email.endsWith('@minor.collyo.app')) return json({ error: 'invalid_email' }, 400)

  const { data: prof } = await admin.from('managed_profiles')
    .select('id, first_name, calendar_id, calendars(owner_id, name)').eq('id', profileId).maybeSingle()
  if (!prof || prof.calendars?.owner_id !== user.id) return json({ error: 'not_allowed' }, 403)

  const { data: existingId } = await admin.rpc('find_user_id_by_email', { p_email: email })
  if (existingId === user.id) return json({ error: 'is_owner' }, 409)

  if (existingId) {
    await admin.from('profile_guardians').upsert(
      { profile_id: profileId, user_id: existingId, role: 'guardian' }, { onConflict: 'profile_id,user_id', ignoreDuplicates: true })
    await admin.from('calendar_members').upsert(
      { calendar_id: prof.calendar_id, user_id: existingId, role: 'contributor' }, { onConflict: 'calendar_id,user_id', ignoreDuplicates: true })
  } else {
    await admin.from('profile_guardian_invites').upsert(
      { profile_id: profileId, email, invited_by: user.id }, { onConflict: 'profile_id,email', ignoreDuplicates: true })
  }

  const { data: ownerProfile } = await admin.from('profiles').select('display_name, email').eq('id', user.id).maybeSingle()
  const ownerName = ownerProfile?.display_name || ownerProfile?.email || 'The team owner'
  const appUrl = Deno.env.get('APP_URL') ?? 'https://collyo.app'
  const team = prof.calendars?.name ?? ''
  const link = existingId ? appUrl : `${appUrl}/#/signup`
  const body1 = existingId
    ? '<p>You were added to the team. Sign in with this address to see the team calendar and the chat, and to sign the declaration if one is waiting.</p>'
    : `<p>Create an account with <strong>${escapeHtml(email)}</strong>. Collyo then sends you a confirmation e-mail: open it to confirm your address (check your spam folder if you do not see it). Once your address is confirmed you are added to the team automatically.</p>`
  const html = `<div style="font-family:system-ui,sans-serif;color:#171717;line-height:1.5">
  ${brandHeader()}
  <p>${escapeHtml(ownerName)} named you as an adult responsible for <strong>${escapeHtml(prof.first_name)}</strong> in the team <strong>${escapeHtml(team)}</strong> on Collyo.</p>
  ${body1}
  <p><a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:12px;background:#171717;color:#fff;text-decoration:none">${existingId ? 'Open Collyo' : 'Create my account'}</a></p>
  <p style="font-size:13px;color:#525252">If you do not know ${escapeHtml(ownerName)}, do nothing and ignore this message.</p>
</div>`
  const sent = await sendMail(email, `${ownerName} named you responsible for ${prof.first_name} in "${team}"`, html)
  return json({ ok: true, linked: !!existingId, emailed: sent })
}

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const from = Deno.env.get('INVITE_FROM') ?? 'Calendar <onboarding@resend.dev>'
  const replyTo = Deno.env.get('INVITE_REPLY_TO') ?? undefined
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], ...(replyTo ? { reply_to: replyTo } : {}), subject, html }),
  })
  return res.ok
}

// info: what the guardian reads. approve: records the approval. Both use the same token checks.
async function useToken(admin: any, body: any): Promise<Response> {
  const token = typeof body.token === 'string' ? body.token : ''
  if (token.length < 20 || token.length > 100) return json({ error: 'invalid_link' }, 400)
  const { data: row } = await admin.from('minor_consents')
    .select('id, profile_id, expires_at, used_at').eq('token_hash', await sha256Hex(token)).maybeSingle()
  if (!row) return json({ error: 'invalid_link' }, 404)

  const { data: prof } = await admin.from('managed_profiles')
    .select('first_name, birth_year, sex, category, consent_status, calendars(name, owner_id)').eq('id', row.profile_id).maybeSingle()
  if (!prof) return json({ error: 'invalid_link' }, 404)

  if (row.used_at || prof.consent_status === 'approved') return json({ error: 'already_used', approved: prof.consent_status === 'approved' }, 410)
  if (new Date(row.expires_at) < new Date()) return json({ error: 'expired' }, 410)

  const { data: owner } = await admin.from('profiles').select('display_name, email').eq('id', prof.calendars?.owner_id).maybeSingle()
  const summary = {
    team_name: prof.calendars?.name, owner_name: owner?.display_name ?? '', owner_email_masked: maskEmail(owner?.email ?? ''), first_name: prof.first_name,
    birth_year: prof.birth_year, has_sex: !!prof.sex, category: prof.category ?? null,
  }
  if (body.action === 'info') return json({ ok: true, ...summary })

  await admin.from('minor_consents').update({ used_at: new Date().toISOString() }).eq('id', row.id)
  await admin.from('managed_profiles').update({
    consent_status: 'approved', consent_approved_at: new Date().toISOString(),
  }).eq('id', row.profile_id)
  return json({ ok: true, approved: true, ...summary })
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
