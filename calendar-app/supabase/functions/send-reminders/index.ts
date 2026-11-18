// Sends due event reminders by e-mail (Resend). Called once a minute by pg_cron (see reminders_cron.sql).
// Secrets: RESEND_API_KEY, CRON_SECRET, REMINDER_FROM (optional), APP_URL (optional).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { brandHeader } from '../_shared/brand.ts'
import { reportError } from '../_shared/ops.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// Reminders are due when now >= starts_at - reminder_minutes. The largest reminder is 60 min,
// so looking one hour and a minute ahead is enough.
const LOOKAHEAD_MS = 61 * 60 * 1000
const MAX_PER_RUN = 200

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Only the scheduler may run this: the secret is set in the function and in the cron job.
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403)

  try {
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const now = new Date()
    const { data: candidates, error } = await supa
      .from('events')
      .select('id, title, starts_at, ends_at, location, reminder_minutes, owner_id, calendar_id')
      .is('reminder_sent_at', null)
      .not('reminder_minutes', 'is', null)
      .gte('starts_at', now.toISOString())
      .lte('starts_at', new Date(now.getTime() + LOOKAHEAD_MS).toISOString())
      .limit(MAX_PER_RUN)
    if (error) throw error

    const due = (candidates || []).filter((e) =>
      now.getTime() >= new Date(e.starts_at).getTime() - e.reminder_minutes * 60_000)
    if (!due.length) return json({ sent: 0 })

    // Recipient: the person who created the event.
    const ownerIds = [...new Set(due.map((e) => e.owner_id))]
    const { data: profiles, error: pErr } = await supa.from('profiles').select('id, email, display_name').in('id', ownerIds)
    if (pErr) throw pErr
    const owners = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

    let sent = 0
    const failed: string[] = []
    for (const ev of due) {
      const owner = owners[ev.owner_id]
      if (!owner?.email) continue
      const res = await sendMail(owner.email, ev)
      if (!res.ok) { failed.push(ev.id); continue }
      // Mark only after a successful send, so a failed send is retried on the next run.
      await supa.from('events').update({ reminder_sent_at: new Date().toISOString() }).eq('id', ev.id)
      sent++
    }
    return json({ sent, failed })
  } catch (e) {
    await reportError('send-reminders', e)
    return json({ error: 'server_error' }, 500)
  }
})

async function sendMail(to: string, ev: {
  title: string; starts_at: string; ends_at: string; location: string | null; reminder_minutes: number
}) {
  const from = Deno.env.get('REMINDER_FROM') ?? 'Calendar <noreply@collyo.app>'
  const appUrl = Deno.env.get('APP_URL') ?? 'https://collyo.app'
  const when = new Date(ev.starts_at).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' })
  const place = ev.location ? `<p>Where: ${escapeHtml(ev.location)}</p>` : ''
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Reminder: ${ev.title}`,
      html: `<div style="font-family:system-ui,sans-serif;color:#171717;line-height:1.5">
  ${brandHeader()}
  <p>Starts in ${ev.reminder_minutes} minute${ev.reminder_minutes === 1 ? '' : 's'}:</p>
  <p><strong>${escapeHtml(ev.title)}</strong><br>${escapeHtml(when)} (UTC)</p>
  ${place}
  <p><a href="${appUrl}" style="color:#171717">Open the calendar</a></p>
</div>`,
    }),
  })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
