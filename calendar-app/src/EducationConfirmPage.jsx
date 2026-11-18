import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { PRICING } from './pricing.js'
import { confirmEducation } from './lib/api.js'
import Logo from './Logo.jsx'

// Opened from the e-mail sent to the school address (#/education?token=...). No sign-in needed: the token is the proof.
export default function EducationConfirmPage({ token }) {
  const { lang } = useI18n()
  const L = PRICING[lang] || PRICING.en
  const [state, setState] = useState('working')

  useEffect(() => {
    confirmEducation(token)
      .then((r) => setState(r?.status === 'approved' ? 'approved' : 'review'))
      .catch((ex) => setState(ex.message === 'expired' ? 'expired' : 'bad'))
  }, [token])

  const text = { approved: L.eduConfirmApproved, review: L.eduConfirmReview, expired: L.eduConfirmExpired, bad: L.eduConfirmBad }[state]
  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 md:p-8 shadow-xl space-y-4" data-education-confirm={state}>
        <Logo />
        <h1 className="text-xl font-semibold text-neutral-900">{L.eduConfirmTitle}</h1>
        <p className="text-sm text-neutral-700">{state === 'working' ? '…' : text}</p>
        {state !== 'working' && <a href="#/pricing" className="inline-block text-sm text-neutral-700 underline underline-offset-2">{L.seeAllPlans}</a>}
      </div>
    </div>
  )
}
