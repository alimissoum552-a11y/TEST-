import { useI18n } from './i18n/index.jsx'
import { PRICING } from './pricing.js'

// Explains a plan limit refused by the database (migration 030) and links to the plans.
// `code` is the error message: plan_limit_calendars | plan_limit_members | plan_limit_team_wellbeing.
export const PLAN_LIMIT_KEYS = {
  plan_limit_calendars: 'planLimitCalendars',
  plan_limit_members: 'planLimitMembers',
  plan_limit_team_wellbeing: 'planLimitTeamWellbeing',
}

export function planLimitCode(message) {
  const m = String(message ?? '').match(/plan_limit_(calendars|members|team_wellbeing)/)
  return m ? m[0] : null
}

export default function PlanLimitNote({ code }) {
  const { t, lang } = useI18n()
  if (!code || !PLAN_LIMIT_KEYS[code]) return null
  return (
    <p className="text-sm text-neutral-900" role="alert" data-plan-limit={code}>
      {t(PLAN_LIMIT_KEYS[code])}{' '}
      <a href="#/pricing" className="underline underline-offset-2">{(PRICING[lang] || PRICING.en).seeAllPlans}</a>
    </p>
  )
}
