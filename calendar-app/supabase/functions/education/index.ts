// Education price (docs/PRICING.md, "Education").
//   request : signed-in adult gives school name, school e-mail and country; a confirmation link goes to that address.
//   status  : signed-in user reads their request.
//   confirm : the link (token) confirms the address; known school domains are approved at once, others wait for review.
//   decide  : support approves or rejects a request under review (x-cron-secret header; see docs/OPERATIONS.md).
// Approved accounts get the 50 % coupon applied at checkout for Pro and Team (groups) (billing function).
// Deployed with --no-verify-jwt: `confirm` comes from an e-mail link and `decide` from support; the others check the session.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isFreeMail, isSchoolDomain } from '../_shared/education.ts'
import { validEmail } from '../_shared/access.ts'
import { brandHeader } from '../_shared/brand.ts'
import { reportError } from '../_shared/ops.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const TOKEN_DAYS = 7

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json().catch(() => ({}))
    if (body?.action === 'confirm') return await confirm(admin, String(body.token ?? ''))
    if (body?.action === 'decide') return await decide(req, admin, body)

    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)
    if (body?.action === 'status') {
      const { data } = await admin.from('education_requests').select('school_name, school_email, status, created_at').eq('user_id', user.id).maybeSingle()
      return json({ request: data ?? null })
    }
    if (body?.action === 'request') return await request(admin, user, body)
    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    await reportError('education', e)
    return json({ error: 'server_error' }, 500)
  }
})

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function request(admin: any, user: any, body: any): Promise<Response> {
  const { data: me } = await admin.from('profiles').select('account_type').eq('id', user.id).maybeSingle()
  if (me?.account_type === 'minor') return json({ error: 'not_allowed' }, 403)
  const school = String(body.school_name ?? '').trim().slice(0, 120)
  const email = String(body.school_email ?? '').trim().toLowerCase()
  const country = String(body.country ?? '').trim().slice(0, 60)
  if (school.length < 2) return json({ error: 'invalid_school' }, 400)
  if (!validEmail(email)) return json({ error: 'invalid_email' }, 400)
  if (isFreeMail(email)) return json({ error: 'school_email_required' }, 400)

  const { data: existing } = await admin.from('education_requests').select('status, created_at').eq('user_id', user.id).maybeSingle()
  if (existing?.status === 'approved') return json({ error: 'already_approved' }, 409)
  // One new link per 10 minutes, so the address cannot be flooded.
  if (existing?.status === 'email_sent' && Date.now() - Date.parse(existing.created_at) < 10 * 60_000) return json({ error: 'wait' }, 429)

  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  await admin.from('education_requests').upsert({
    user_id: user.id, school_name: school, school_email: email, country, status: 'email_sent',
    token_hash: await sha256(token), token_expires_at: new Date(Date.now() + TOKEN_DAYS * 86400_000).toISOString(),
    created_at: new Date().toISOString(), confirmed_at: null, decided_at: null, note: null,
  }, { onConflict: 'user_id' })

  const appUrl = (Deno.env.get('APP_URL') ?? 'https://collyo.app').replace(/\/+$/, '')
  const link = `${appUrl}/#/education?token=${encodeURIComponent(token)}`
  const html = `<div style="font-family:system-ui,sans-serif;color:#171717;line-height:1.5">
  ${brandHeader()}
  <p>A Collyo account asked for the education price for <strong>${escapeHtml(school)}</strong> and gave this school address.</p>
  <p><a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:12px;background:#171717;color:#fff;text-decoration:none">Confirm my school address</a></p>
  <p style="font-size:13px;color:#525252">The link works for ${TOKEN_DAYS} days. If you did not ask for it, do nothing.</p>
</div>`
  const sent = await sendMail(email, 'Confirm your school address for Collyo', html)
  return json({ ok: true, emailed: sent })
}

async function confirm(admin: any, token: string): Promise<Response> {
  if (token.length < 20 || token.length > 100) return json({ error: 'invalid_link' }, 400)
  const { data: row } = await admin.from('education_requests').select('user_id, school_email, status, token_expires_at')
    .eq('token_hash', await sha256(token)).maybeSingle()
  if (!row || row.status !== 'email_sent') return json({ error: 'invalid_link' }, 404)
  if (Date.parse(row.token_expires_at) < Date.now()) return json({ error: 'expired' }, 410)
  const approved = isSchoolDomain(row.school_email)
  const now = new Date().toISOString()
  await admin.from('education_requests').update({
    status: approved ? 'approved' : 'review', confirmed_at: now, decided_at: approved ? now : null, token_hash: null,
    note: approved ? 'school domain' : null,
  }).eq('user_id', row.user_id)
  return json({ ok: true, status: approved ? 'approved' : 'review' })
}

async function decide(req: Request, admin: any, body: any): Promise<Response> {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403)
  const userId = String(body.user_id ?? '')
  const approve = body.approve === true
  const { data: row } = await admin.from('education_requests').select('user_id, school_name, status').eq('user_id', userId).maybeSingle()
  if (!row || row.status !== 'review') return json({ error: 'not_in_review' }, 409)
  await admin.from('education_requests').update({ status: approve ? 'approved' : 'rejected', decided_at: new Date().toISOString(), note: String(body.note ?? '').slice(0, 200) || null }).eq('user_id', userId)
  const { data: u } = await admin.auth.admin.getUserById(userId)
  if (u?.user?.email) {
    const text = approve
      ? `Your education price for ${row.school_name} is active: 50 % off Pro and Team (groups), applied at checkout.`
      : `We could not confirm that this account belongs to a teacher of ${row.school_name}. Reply to support@collyo.app with a document if you think this is a mistake.`
    await sendMail(u.user.email, approve ? 'Your Collyo education price is active' : 'Your Collyo education request', `<div style="font-family:system-ui,sans-serif;color:#171717;line-height:1.5">${brandHeader()}<p>${escapeHtml(text)}</p></div>`)
  }
  return json({ ok: true, status: approve ? 'approved' : 'rejected' })
}

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const from = Deno.env.get('INVITE_FROM') ?? 'Collyo <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  }).catch(() => null)
  return !!res?.ok
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
