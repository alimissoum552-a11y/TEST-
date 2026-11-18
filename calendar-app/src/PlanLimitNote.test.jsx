import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { I18nProvider } from './i18n/index.jsx'
import PlanLimitNote, { planLimitCode } from './PlanLimitNote.jsx'

describe('plan limit note', () => {
  it('recognises the database codes inside an error message', () => {
    expect(planLimitCode('plan_limit_members')).toBe('plan_limit_members')
    expect(planLimitCode('ERROR: plan_limit_calendars (hint pro)')).toBe('plan_limit_calendars')
    expect(planLimitCode('something else')).toBeNull()
  })
  it('explains the limit with a link to the plans', () => {
    const html = renderToString(<I18nProvider><PlanLimitNote code="plan_limit_calendars" /></I18nProvider>)
    expect(html).toContain('#/pricing')
    expect(html).not.toContain('planLimitCalendars')
    expect(renderToString(<I18nProvider><PlanLimitNote code={null} /></I18nProvider>)).toBe('')
  })
})
