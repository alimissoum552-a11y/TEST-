import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { I18nProvider } from './i18n/index.jsx'
vi.mock('./lib/supabase.js', () => ({ supabase: {} }))
vi.mock('./lib/api.js', () => ({}))
import { AnalysisLog } from './TeamWellbeing.jsx'

const wrap = (el) => renderToString(<I18nProvider>{el}</I18nProvider>)

// Regression: the journal once used untranslated identifiers (ReferenceError) and blanked the team panel.
describe('team well-being journal', () => {
  it('renders with no runs', () => {
    expect(() => wrap(<AnalysisLog log={[]} locale="en" />)).not.toThrow()
  })
  it('renders with runs', () => {
    const log = [{ ran_at: '2026-11-17T10:17:00Z', sources: 'agenda,messages', messages_read: 4, load_days: 1, crisis_alerts: 0, posted: true }]
    expect(() => wrap(<AnalysisLog log={log} locale='en' />)).not.toThrow()
  })
  it('shows translated labels, not key names', () => {
    const html = wrap(<AnalysisLog log={[]} locale="en" />)
    expect(html).toContain('Analysis log')
    expect(html).not.toContain('wbLog')
  })
})
