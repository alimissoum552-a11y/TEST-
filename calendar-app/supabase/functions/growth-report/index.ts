// Weekly growth e-mail (Monday 07:00 UTC, pg_cron with x-cron-secret), from growth_report() (docs/GROWTH.md).
// The numbers come from the app's own data: no cookie, no tracker. Sent to OPS_ALERT_TO (default support@collyo.app).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { reportError } from '../_shared/ops.ts'

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: r, error } = await admin.rpc('growth_report', { p_weeks: 8 })
    if (error) throw error
    const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '-')
    const weeks = (r.weeks ?? []).map((w: any) =>
      `  ${w.week}  sign-ups ${String(w.signups).padStart(3)}  activated ${String(w.activated).padStart(3)} (${pct(w.activated, w.signups)})  came back ${w.old_enough_for_return ? `${w.came_back}/${w.old_enough_for_return} (${pct(w.came_back, w.old_enough_for_return)})` : '-'}`)
    const paying = Object.entries(r.paying ?? {}).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'
    const text = [
      'Collyo, weekly numbers (adults, launch test accounts left out):',
      '',
      `People: ${r.people} · active in the last 7 days: ${r.active_7_days}`,
      `Shared calendars with 3 people or more: ${r.shared_calendars_3_plus}`,
      `Paying: ${paying} · monthly revenue at list price: ${Number(r.monthly_revenue_list_eur).toFixed(2)} EUR · teachers approved: ${r.education_approved}`,
      '',
      'By week of sign-up (activated = made an event and shared within 7 days; came back = active between day 7 and 14):',
      ...(weeks.length ? weeks : ['  no sign-up yet']),
      '',
      'Definitions and goals: docs/GROWTH.md.',
    ].join('\n')
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('INVITE_FROM') ?? 'Collyo <onboarding@resend.dev>', to: [Deno.env.get('OPS_ALERT_TO') ?? 'support@collyo.app'], subject: `Collyo weekly numbers: ${r.people} people, ${r.active_7_days} active`, text }),
    })
    return json({ ok: true, sent: res.ok })
  } catch (e) {
    await reportError('growth-report', e)
    return json({ error: 'server_error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
