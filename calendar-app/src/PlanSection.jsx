import { useCallback, useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { PRICING } from './pricing.js'
import { getMySubscription, countMyAiUsageThisMonth, openBillingPortal } from './lib/api.js'
import { meterState, monthStartIso } from './lib/plans.js'

// "My plan" in the profile: the plan, the AI requests used this month and the way to manage the subscription.
// justSubscribed: the person has just come back from the payment page; the webhook may need a few seconds.
export default function PlanSection({ userId, justSubscribed = false }) {
  const { lang, locale } = useI18n()
  const L = PRICING[lang] || PRICING.en
  const [sub, setSub] = useState(undefined) // undefined = loading, null = none
  const [used, setUsed] = useState(0)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      // Both are read before anything is shown, so the meter never flashes a wrong number.
      const [s, n] = await Promise.all([getMySubscription(userId), countMyAiUsageThisMonth(userId, monthStartIso())])
      setSub(s); setUsed(n); setFailed(false)
      return s
    } catch {
      setFailed(true)
      return null
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  // After a payment, check again every 3 seconds (up to 8 times) until the subscription shows as paid.
  useEffect(() => {
    if (!justSubscribed) return
    let tries = 0
    const timer = setInterval(async () => {
      tries += 1
      const s = await load()
      if (s?.source === 'stripe' || tries >= 8) clearInterval(timer)
    }, 3000)
    return () => clearInterval(timer)
  }, [justSubscribed, load])

  const portal = async () => {
    setBusy(true)
    try { window.location.href = (await openBillingPortal()).url } catch { setFailed(true); setBusy(false) }
  }

  const planName = sub ? (sub.plan_code === 'launch' ? L.launchName : (L.plans[sub.plan_code]?.name || sub.plan_code)) : ''
  const meter = sub ? meterState(sub.plan, sub.status, sub.seats, used) : null
  const date = (iso) => new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(iso))

  return (
    <section className="space-y-2 border-t border-neutral-100 pt-4" data-plan-section>
      <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500">{L.planSection}</h4>
      {failed && <p className="text-sm text-neutral-700">{L.billingError}</p>}
      {sub === undefined && !failed && <p className="text-sm text-neutral-500">…</p>}
      {sub && (
        <>
          <p className="text-sm text-neutral-900">
            <span className="font-medium" data-plan-name>{planName}</span>
            {sub.source === 'stripe' && (
              <span className="text-neutral-600"> · {sub.status === 'canceled' ? L.statusCanceled : L.statusActive}
                {sub.plan_code === 'team_work' ? ` · ${sub.seats} ${L.perSeat}` : ''}</span>
            )}
          </p>
          {sub.status === 'past_due' && <p className="text-xs font-medium text-neutral-900">{L.statusPastDue}</p>}
          {sub.source === 'stripe' && sub.status !== 'canceled' && sub.current_period_end && (
            <p className="text-xs text-neutral-500">{L.renews} {date(sub.current_period_end)}</p>
          )}

          <div className="space-y-1" data-ai-meter>
            <p className="text-xs text-neutral-600">{L.aiMonth}</p>
            {meter.kind === 'none' && <p className="text-xs text-neutral-700">{L.noAi}</p>}
            {meter.kind === 'unlimited' && <p className="text-xs text-neutral-700"><span className="font-medium">{used}</span> · {L.unlimitedLaunch}</p>}
            {meter.kind === 'limited' && (
              <>
                <p className="text-xs text-neutral-700"><span className="font-medium">{used} / {meter.limit}</span></p>
                <div className="h-1.5 w-full rounded-full bg-neutral-100" role="progressbar" aria-valuemin={0} aria-valuemax={meter.limit} aria-valuenow={Math.min(used, meter.limit)} aria-label={L.aiMonth}>
                  <div className="h-1.5 rounded-full bg-neutral-900" style={{ width: `${meter.percent}%` }} />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <a href="#/pricing" className="text-sm text-neutral-700 underline underline-offset-2">{L.seeAllPlans}</a>
            {sub.source === 'stripe' && sub.stripe_customer_id && (
              <button type="button" onClick={portal} disabled={busy} data-manage-subscription
                className="text-sm text-neutral-700 underline underline-offset-2 disabled:opacity-50">{L.manage}</button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
