// Runs every 15 minutes (pg_cron, x-cron-secret). Looks for problems since the last run and e-mails one digest:
// new unexpected errors (functions and web app), failed scheduled jobs, Stripe webhook deliveries that failed,
// and the site not answering. Nothing is sent when everything is fine.
// Secrets: CRON_SECRET, RESEND_API_KEY, OPS_ALERT_TO (default support@collyo.app), INVITE_FROM, STRIPE_BILLING_LIVE_API_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { reportError } from '../_shared/ops.ts'

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    const now = new Date()
    const { data: last } = await admin.from('ops_state').select('value').eq('key', 'last_run').maybeSingle()
    const since = last?.value ?? new Date(now.getTime() - 15 * 60_000).toISOString()
    const lines: string[] = []

    // 1. Unexpected errors not yet reported.
    const { data: errors } = await admin.from('ops_errors').select('id, source, code, message').is('alerted_at', null).order('at').limit(500)
    if (errors?.length) {
      const groups = new Map<string, { n: number; sample: string }>()
      for (const e of errors) {
        const k = `${e.source} · ${e.code ?? ''}`
        const g = groups.get(k) ?? { n: 0, sample: e.message ?? '' }
        g.n++; groups.set(k, g)
      }
      lines.push(`Unexpected errors: ${errors.length}`)
      for (const [k, g] of groups) lines.push(`  - ${k}: ${g.n} (e.g. ${g.sample.slice(0, 160)})`)
    }

    // 2. Scheduled jobs that failed.
    const { data: crons } = await admin.rpc('ops_cron_failures', { p_since: since })
    if (crons?.length) {
      lines.push('Scheduled jobs that failed:')
      for (const c of crons) lines.push(`  - ${c.jobname}: ${c.failures} (${String(c.last_message ?? '').slice(0, 160)})`)
    }

    // 3. Stripe webhook deliveries that failed (live mode).
    const stripeKey = Deno.env.get('STRIPE_BILLING_LIVE_API_KEY')
    if (stripeKey) {
      const created = Math.floor(Date.parse(since) / 1000) - 3600
      const res = await fetch(`https://api.stripe.com/v1/events?delivery_success=false&limit=20&created[gte]=${created}`, { headers: { Authorization: `Bearer ${stripeKey}` } })
      if (res.ok) {
        const events = (await res.json())?.data ?? []
        if (events.length) lines.push(`Stripe events not delivered to a webhook: ${events.length} (${[...new Set(events.map((e: any) => e.type))].join(', ')})`)
      }
    }

    // 4. Education requests waiting for a manual check.
    const { count: eduReview } = await admin.from('education_requests').select('user_id', { count: 'exact', head: true }).eq('status', 'review').gte('confirmed_at', since)
    if (eduReview) lines.push(`Education requests to check: ${eduReview} (table education_requests, status review; docs/OPERATIONS.md, "Education requests")`)

    // 5. The site answers.
    const site = await fetch(Deno.env.get('APP_URL') ?? 'https://collyo.app', { method: 'GET' }).then((r) => r.status).catch(() => 0)
    const { data: down } = await admin.from('ops_state').select('value').eq('key', 'site_down_since').maybeSingle()
    if (site !== 200 && !down) {
      lines.push(`The site does not answer (status ${site}).`)
      await admin.from('ops_state').upsert({ key: 'site_down_since', value: now.toISOString(), updated_at: now.toISOString() })
    } else if (site === 200 && down) {
      lines.push(`The site answers again (it was down since ${down.value}).`)
      await admin.from('ops_state').delete().eq('key', 'site_down_since')
    }

    let sent = false
    if (lines.length) {
      sent = await sendDigest(lines)
      if (sent && errors?.length) await admin.from('ops_errors').update({ alerted_at: now.toISOString() }).in('id', errors.map((e) => e.id))
    }
    await admin.from('ops_state').upsert({ key: 'last_run', value: now.toISOString(), updated_at: now.toISOString() })
    return json({ ok: true, problems: lines.length, sent })
  } catch (e) {
    await reportError('ops-alert', e)
    return json({ error: 'server_error' }, 500)
  }
})

async function sendDigest(lines: string[]): Promise<boolean> {
  const to = Deno.env.get('OPS_ALERT_TO') ?? 'support@collyo.app'
  const from = Deno.env.get('INVITE_FROM') ?? 'Collyo <onboarding@resend.dev>'
  const text = ['Collyo monitoring found something to look at:', '', ...lines, '', 'Details: table ops_errors in Supabase (docs/OPERATIONS.md, "Monitoring").'].join('\n')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: `Collyo monitoring: ${lines[0].slice(0, 80)}`, text }),
  })
  return res.ok
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
