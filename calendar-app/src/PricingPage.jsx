import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { PRICING } from './pricing.js'
import { supabase } from './lib/supabase.js'

const ORDER = ['free', 'starter', 'pro', 'team_groups', 'team_work']

// Public plans page. The numbers come from the `plans` table, the text from pricing.js.
// It is a preview: nothing can be bought yet (docs/PRICING.md).
export default function PricingPage({ onBack }) {
  const { t, lang, locale } = useI18n()
  const L = PRICING[lang] || PRICING.en
  const [plans, setPlans] = useState(null) // null = loading, false = error
  const [yearly, setYearly] = useState(true)

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

        <div role="group" aria-label={`${L.monthly} / ${L.yearly}`} className="inline-flex rounded-full bg-white ring-1 ring-neutral-300 p-1">
          {[[false, L.monthly], [true, L.yearly]].map(([val, label]) => (
            <button key={String(val)} type="button" onClick={() => setYearly(val)} aria-pressed={yearly === val}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${yearly === val ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}>
              {label}{val && <span className="ms-2 text-xs opacity-80">{L.saveYear}</span>}
            </button>
          ))}
        </div>

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
                  {code === 'free'
                    ? <a href="#/signup" className="mt-6 text-center px-4 py-2.5 rounded-2xl bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-700">{L.startFree}</a>
                    : <button type="button" disabled className="mt-6 px-4 py-2.5 rounded-2xl bg-neutral-100 text-sm font-medium text-neutral-500">{L.soon}</button>}
                </li>
              )
            })}
            <li className="flex flex-col rounded-3xl bg-white p-6 ring-1 ring-neutral-300">
              <h2 className="text-lg font-semibold text-neutral-900">{L.eduTitle}</h2>
              <p className="mt-3 text-sm text-neutral-700">{L.eduText}</p>
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
