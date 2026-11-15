// Sends a calendar invitation email through Resend.
// Deployed as a Supabase Edge Function. Secrets: RESEND_API_KEY, INVITE_FROM, APP_URL.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const auth = req.headers.get('Authorization') ?? ''
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })

    const { calendar_id, email, role, invite_id } = await req.json()
    if (!invite_id) return json({ error: 'missing invite_id' }, 400)
    const inviteId = invite_id as string
    if (!calendar_id || !email || !role) return json({ error: 'missing fields' }, 400)

    // The caller must be able to manage this calendar (RLS-enforced read of the calendar).
    const { data: cal, error: calErr } = await supa
      .from('calendars').select('id, name').eq('id', calendar_id).single()
    if (calErr || !cal) return json({ error: 'not allowed' }, 403)

    const { data: { user } } = await supa.auth.getUser()
    const inviter = user?.user_metadata?.display_name || user?.email || 'Someone'

    const appUrl = Deno.env.get('APP_URL') ?? 'https://calendar-app-rho-ten.vercel.app'
    const from = Deno.env.get('INVITE_FROM') ?? 'Calendar <onboarding@resend.dev>'

    // The link opens the app on the invitee's account and joins the team automatically.
    // Only the account whose e-mail matches the invite can accept it.
    const joinUrl = `${appUrl}/#/join?invite=${encodeURIComponent(inviteId)}`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${inviter} invited you to join "${cal.name}"`,
        html: `<div style="font-family:system-ui,sans-serif;color:#171717;line-height:1.5">
  <p>${escapeHtml(inviter)} invited you to join the calendar <strong>${escapeHtml(cal.name)}</strong> as <strong>${escapeHtml(role)}</strong>.</p>
  <p><strong>Opening the link below means joining the team.</strong> You will be added to the calendar automatically, on your own account, and you will see its events.</p>
  <p><a href="${joinUrl}" style="display:inline-block;padding:10px 18px;border-radius:12px;background:#171717;color:#fff;text-decoration:none">Join the team</a></p>
  <p style="font-size:13px;color:#525252">Sign in or create an account with <strong>${escapeHtml(email)}</strong> to join. The link only works for that address.</p>
  <p style="font-size:13px;color:#525252">If you do not want to join, do nothing. You will not be added and will not see this calendar.</p>
</div>`,
      }),
    })
    if (!res.ok) return json({ error: await res.text() }, 502)
    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
