import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { PRICING } from './pricing.js'
import { supabase } from './lib/supabase.js'
import { startCheckout, openBillingPortal, requestEducation, getEducationStatus, getBillingMe, adminSetPlan, getMySubscription } from './lib/api.js'

// Payment buttons stay disabled until billing is opened for real (build setting VITE_BILLING_OPEN=true). docs/PRICING.md.
const BILLING_OPEN = import.meta.env.VITE_BILLING_OPEN === 'true'

const ORDER = ['free', 'starter', 'pro', 'team_groups', 'team_work']

// Public plans page. The numbers come from the `plans` table, the text from pricing.js.
// It is a preview: nothing can be bought yet (docs/PRICING.md).
export default function PricingPage({ onBack }) {
  const { t, lang, locale } = useI18n()
  const L = PRICING[lang] || PRICING.en
  const [plans, setPlans] = useState(null) // null = loading, false = error
  const [yearly, setYearly] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [seats, setSeats] = useState(3)
  const [busyPlan, setBusyPlan] = useState(null)
  const [note, setNote] = useState(null)

  const [isAdmin, setIsAdmin] = useState(false)
  const [currentPlan, setCurrentPlan] = useState(null)
  const switchPlan = async (code) => {
    setBusyPlan(code); setNote(null)
    try {
      await adminSetPlan(code)
      setCurrentPlan(code)
      setNote(L.adminDone.replace('{plan}', code === 'launch' ? L.launchName : (L.plans[code]?.name || code)))
    } catch (ex) { setNote(ex.message === 'stripe_subscription_active' ? L.adminStripe : L.checkoutError) }
    finally { setBusyPlan(null) }
  }
  const [edu, setEdu] = useState(null) // the signed-in user's education request, if any
  const [eduForm, setEduForm] = useState(null) // { school, email, country } while the form is open
  const [eduMsg, setEduMsg] = useState(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data?.session)
      if (data?.session) {
        getEducationStatus().then((r) => setEdu(r?.request ?? null)).catch(() => {})
        getBillingMe().then((r) => setIsAdmin(!!r?.admin)).catch(() => {})
        getMySubscription(data.session.user.id).then((sub) => setCurrentPlan(sub?.plan_code ?? null)).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  const sendEducation = async (e) => {
    e.preventDefault(); setEduMsg(null)
    try {
      await requestEducation(eduForm.school.trim(), eduForm.email.trim(), eduForm.country.trim())
      setEduForm(null); setEdu({ status: 'email_sent' })
    } catch (ex) {
      setEduMsg(ex.message === 'school_email_required' ? L.eduErrFreeMail : ex.message === 'wait' ? L.eduErrWait : L.eduErr)
    }
  }

  // Signed out: go and create an account first. Signed in: open the Stripe payment page, or the portal if already subscribed.
  const choose = async (code) => {
    if (!signedIn) { window.location.hash = '#/signup'; return }
    setBusyPlan(code); setNote(null)
    try {
      const { url } = await startCheckout(code, yearly ? 'year' : 'month', code === 'team_work' ? Math.max(3, Number(seats) || 3) : undefined)
      window.location.href = url
    } catch (ex) {
      if (ex.message === 'already_subscribed') {
        setNote(L.alreadySubscribed)
        try { window.location.href = (await openBillingPortal()).url; return } catch { /* the note stays */ }
      } else setNote(L.checkoutError)
      setBusyPlan(null)
    }
  }

  useEffect(() => {
    let live = true
    if (!supabase) { setPlans(false); return }
    supabase.from('plans').select('code, price_month_cents, price_year_cents, price_includes_tax, min_seats').order('sort')
      .then(({ data, error }) => { if (live) setPlans(error || !data ? false : data) })
      .catch(() => { if (live) setPlans(false) })
    return () => { live = false }
  }, [])

  const money = (cents) => new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
  }).format(cents / 100)
  const byCode = Object.fromEntries((plans || []).map((p) => [p.code, p]))

  const price = (p) => {
    if (!p || p.price_month_cents === 0) return null
    const cents = yearly ? p.price_year_cents : p.price_month_cents
    const unit = yearly ? L.perYear : L.perMonth
    return { main: money(cents), unit: p.code === 'team_work' ? `${L.perSeat} ${unit}` : unit, tax: p.price_includes_tax ? L.taxIncl : L.taxExcl,
      equiv: yearly ? `${money(Math.round(p.price_year_cents / 12))} ${L.perMonth}` : null }
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex justify-center p-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <main className="w-full max-w-6xl space-y-8 py-4 md:py-8">
        <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-900">← {t('back')}</button>

        <header className="space-y-3 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900">{L.title}</h1>
          <p className="text-base text-neutral-600">{L.intro}</p>
          <p role="note" className="rounded-2xl bg-white ring-1 ring-neutral-300 px-4 py-3 text-sm text-neutral-800">{L.banner}</p>
        </header>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white ring-1 ring-neutral-900 px-4 py-3" data-admin-bar>
            <p className="text-sm text-neutral-900">{L.adminNote}{currentPlan ? ` ${L.adminCurrent} : ${currentPlan === 'launch' ? L.launchName : (L.plans[currentPlan]?.name || currentPlan)}.` : ''}</p>
            {currentPlan !== 'launch' && (
              <button type="button" onClick={() => switchPlan('launch')} disabled={busyPlan !== null} data-admin-switch="launch"
                className="px-3 py-1.5 rounded-xl bg-neutral-900 text-xs font-medium text-white disabled:opacity-50">{L.adminBack}</button>
            )}
          </div>
        )}

        <div role="group" aria-label={`${L.monthly} / ${L.yearly}`} className="inline-flex rounded-full bg-white ring-1 ring-neutral-300 p-1">
          {[[false, L.monthly], [true, L.yearly]].map(([val, label]) => (
            <button key={String(val)} type="button" onClick={() => setYearly(val)} aria-pressed={yearly === val}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${yearly === val ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}>
              {label}{val && <span className="ms-2 text-xs opacity-80">{L.saveYear}</span>}
            </button>
          ))}
        </div>

        {note && <p role="alert" className="text-sm font-medium text-neutral-900">{note}</p>}
        {plans === null && <p className="text-sm text-neutral-500">{L.loading}</p>}
        {plans === false && <p className="text-sm font-medium text-neutral-900">{L.error}</p>}

        {plans && (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ORDER.map((code) => {
              const copy = L.plans[code]
              const p = price(byCode[code])
              return (
                <li key={code} data-plan={code} className="flex flex-col rounded-3xl bg-white p-6 ring-1 ring-neutral-200 shadow-sm">
                  <h2 className="text-lg font-semibold text-neutral-900">{copy.name}</h2>
                  <p className="text-sm text-neutral-500">{copy.tag}</p>
                  <p className="mt-4 min-h-[4.5rem]">
                    {p ? (
                      <>
                        <span className="text-3xl font-semibold text-neutral-900">{p.main}</span>{' '}
                        <span className="text-sm text-neutral-600">{p.unit}</span>
                        <span className="block text-xs text-neutral-500">{p.tax}{p.equiv ? ` · ${p.equiv}` : ''}</span>
                      </>
                    ) : <span className="text-3xl font-semibold text-neutral-900">{money(0)}</span>}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-neutral-700 flex-1">
                    {copy.items.map((it, i) => (
                      <li key={i} className="flex gap-2"><span aria-hidden="true" className="text-neutral-900">✓</span><span>{it}</span></li>
                    ))}
                  </ul>
                  {isAdmin
                    ? <button type="button" onClick={() => switchPlan(code)} disabled={busyPlan !== null || currentPlan === code} data-admin-switch={code}
                        className="mt-6 px-4 py-2.5 rounded-2xl bg-neutral-900 text-sm font-medium text-white disabled:opacity-40">{currentPlan === code ? L.adminCurrent : L.adminChoose}</button>
                    : code === 'free'
                    ? <a href="#/signup" className="mt-6 text-center px-4 py-2.5 rounded-2xl bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-700">{L.startFree}</a>
                    : !BILLING_OPEN
                      ? <button type="button" disabled className="mt-6 px-4 py-2.5 rounded-2xl bg-neutral-100 text-sm font-medium text-neutral-500">{L.soon}</button>
                      : (
                        <div className="mt-6 space-y-2">
                          {code === 'team_work' && (
                            <label className="flex items-center justify-between gap-3 text-xs text-neutral-600">{L.seatsLabel}
                              <input type="number" min={3} max={500} value={seats} onChange={(e) => setSeats(e.target.value)}
                                className="w-20 rounded-xl border border-neutral-200 px-2 py-1 text-sm text-neutral-900" />
                            </label>
                          )}
                          <button type="button" onClick={() => choose(code)} disabled={busyPlan !== null} data-choose={code}
                            className="w-full px-4 py-2.5 rounded-2xl bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
                            {busyPlan === code ? L.opening : (signedIn ? L.choose : L.signInToSubscribe)}
                          </button>
                        </div>
                      )}
                </li>
              )
            })}
            <li className="flex flex-col rounded-3xl bg-white p-6 ring-1 ring-neutral-300">
              <h2 className="text-lg font-semibold text-neutral-900">{L.eduTitle}</h2>
              <p className="mt-3 text-sm text-neutral-700">{L.eduText}</p>
              <div className="mt-4 space-y-2 text-sm" data-education>
                {!signedIn && <p className="text-xs text-neutral-500">{L.eduNeedAccount}</p>}
                {signedIn && edu?.status && edu.status !== 'rejected' && (
                  <p className="text-sm text-neutral-900" data-education-status={edu.status}>
                    {{ email_sent: L.eduSent, review: L.eduReview, approved: L.eduApproved }[edu.status]}
                  </p>
                )}
                {signedIn && edu?.status === 'rejected' && <p className="text-xs text-neutral-700">{L.eduRejected}</p>}
                {signedIn && (!edu || edu.status === 'rejected' || edu.status === 'email_sent') && !eduForm && (
                  <button type="button" onClick={() => setEduForm({ school: '', email: '', country: '' })} className="text-sm text-neutral-700 underline underline-offset-2" data-education-ask>{L.eduAsk}</button>
                )}
                {eduForm && (
                  <form onSubmit={sendEducation} className="space-y-2" data-education-form>
                    <input required placeholder={L.eduSchool} value={eduForm.school} onChange={(e) => setEduForm({ ...eduForm, school: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-sm" />
                    <input required type="email" placeholder={L.eduSchoolEmail} value={eduForm.email} onChange={(e) => setEduForm({ ...eduForm, email: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-sm" />
                    <input placeholder={L.eduCountry} value={eduForm.country} onChange={(e) => setEduForm({ ...eduForm, country: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-sm" />
                    <button type="submit" className="w-full px-4 py-2 rounded-2xl bg-neutral-900 text-sm font-medium text-white">{L.eduSend}</button>
                  </form>
                )}
                {eduMsg && <p className="text-xs font-medium text-neutral-900" role="alert">{eduMsg}</p>}
              </div>
            </li>
          </ul>
        )}

        <section className="max-w-3xl space-y-2">
          <h2 className="text-lg font-semibold text-neutral-900">{L.notesTitle}</h2>
          <ul className="space-y-2 text-sm text-neutral-700 list-disc ps-5">
            {L.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </section>
      </main>
    </div>
  )
}
