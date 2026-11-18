import { useCallback, useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { PRICING } from './pricing.js'
import { getMySubscription, countMyAiUsageThisMonth, openBillingPortal, requestRefund } from './lib/api.js'
import { meterState, monthStartIso, refundDeadline } from './lib/plans.js'

// "My plan" in the profile: the plan, the AI requests used this month and the way to manage the subscription.
// justSubscribed: the person has just come back from the payment page; the webhook may need a few seconds.
export default function PlanSection({ userId, justSubscribed = false }) {
  const { lang, locale } = useI18n()
  const L = PRICING[lang] || PRICING.en
  const [sub, setSub] = useState(undefined) // undefined = loading, null = none
  const [used, setUsed] = useState(0)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmRefund, setConfirmRefund] = useState(false)
  const [refundMsg, setRefundMsg] = useState(null)

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

  const refund = async () => {
    setBusy(true); setRefundMsg(null)
    try {
      await requestRefund()
      setRefundMsg(L.refundDone); setConfirmRefund(false)
      // The webhook puts the previous plan back within seconds.
      setTimeout(load, 4000); setTimeout(load, 9000)
    } catch (ex) {
      setRefundMsg(ex.message === 'refund_window_passed' ? L.refundLate : L.refundError)
    } finally { setBusy(false) }
  }

  const planName = sub ? (sub.plan_code === 'launch' ? L.launchName : (L.plans[sub.plan_code]?.name || sub.plan_code)) : ''
  const meter = sub ? meterState(sub.plan, sub.status, sub.seats, used) : null
  const deadline = sub && sub.source === 'stripe' && sub.status !== 'canceled' ? refundDeadline(sub.plan_code, sub.started_at) : null
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
          {sub.source === 'stripe' && sub.status !== 'canceled' && (sub.cancel_at || sub.current_period_end) && (
            <p className="text-xs text-neutral-500" data-plan-date>{sub.cancel_at ? `${L.endsOn} ${date(sub.cancel_at)}` : `${L.renews} ${date(sub.current_period_end)}`}</p>
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

          {deadline && deadline > new Date() && (
            <div className="space-y-2 pt-1" data-refund>
              <p className="text-xs text-neutral-500">{L.refundUntil} {date(deadline.toISOString())}</p>
              {!confirmRefund ? (
                <button type="button" onClick={() => setConfirmRefund(true)} className="text-sm text-neutral-700 underline underline-offset-2">{L.refundAsk}</button>
              ) : (
                <div className="space-y-2 rounded-2xl ring-1 ring-neutral-300 p-3">
                  <p className="text-xs text-neutral-700">{L.refundConfirm}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfirmRefund(false)} disabled={busy} className="flex-1 py-1.5 rounded-xl bg-neutral-100 text-xs">{L.refundCancel}</button>
                    <button type="button" onClick={refund} disabled={busy} data-refund-confirm className="flex-1 py-1.5 rounded-xl bg-neutral-900 text-white text-xs disabled:opacity-50">{L.refundYes}</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {refundMsg && <p className="text-xs font-medium text-neutral-900" role="status">{refundMsg}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <a href="#/pricing" className="text-sm text-neutral-700 underline underline-offset-2">{L.seeAllPlans}</a>
            {sub.stripe_customer_id && (
              <button type="button" onClick={portal} disabled={busy} data-manage-subscription
                className="text-sm text-neutral-700 underline underline-offset-2 disabled:opacity-50">{L.manage}</button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
