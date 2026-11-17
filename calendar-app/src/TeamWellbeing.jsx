import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import {
  getTeamWellbeing, saveTeamWellbeing, getMyWellbeingOptout, setMyWellbeingOptout, getWellbeingAnalysisLog,
} from './lib/api.js'

const DEFAULTS = { enabled: false, use_agenda: true, use_messages: false, meeting_hours_alert: 3 }

// Owner-only settings for the team well-being mode. Members get the same block read-only.
export function TeamWellbeingSettings({ calendarId, userId, isOwner }) {
  const { t, locale } = useI18n()
  const [log, setLog] = useState(null)
  const [form, setForm] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    getTeamWellbeing(calendarId)
      .then((row) => { if (row) setForm({ ...DEFAULTS, ...row, meeting_hours_alert: Number(row.meeting_hours_alert) }) })
      .catch((ex) => setErr(ex.message))
      .finally(() => setLoaded(true))
  }, [calendarId])

  const set = (key, value) => { setSaved(false); setForm((f) => ({ ...f, [key]: value })) }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const row = await saveTeamWellbeing(calendarId, userId, {
        enabled: form.enabled,
        use_agenda: form.use_agenda,
        // Messages are analysed only with the agenda or alone; at least one source must stay on when enabled.
        use_messages: form.use_messages,
        meeting_hours_alert: Math.min(12, Math.max(1, Number(form.meeting_hours_alert) || 3)),
      })
      setForm({ ...DEFAULTS, ...row, meeting_hours_alert: Number(row.meeting_hours_alert) })
      setSaved(true)
    } catch (ex) {
      setErr(ex.message === 'not_allowed' ? t('teamWbOwnerOnly') : ex.message)
    } finally { setBusy(false) }
  }

  useEffect(() => {
    if (isOwner) getWellbeingAnalysisLog(calendarId).then(setLog).catch(() => setLog([]))
  }, [calendarId, isOwner])

  if (!loaded) return null

  const sourcesOk = form.use_agenda || form.use_messages
  const summary = form.enabled
    ? [form.use_agenda && t('teamWbAgenda'), form.use_messages && t('teamWbMessages')].filter(Boolean).join(' · ')
    : null

  if (!isOwner) {
    return (
      <section className="rounded-2xl border border-neutral-200 p-4 space-y-2">
        <p className="text-sm font-semibold text-neutral-900">{t('teamWb')}</p>
        <p className="text-xs text-neutral-500">{t('teamWbOwnerNote')}</p>
        {form.enabled && <p className="text-xs text-neutral-700">{summary}</p>}
      </section>
    )
  }

  const check = (key, label, disabled = false) => (
    <label className="flex items-start gap-3 text-sm text-neutral-800">
      <input type="checkbox" checked={!!form[key]} disabled={busy || disabled}
        onChange={(e) => set(key, e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-900" />
      <span>{label}</span>
    </label>
  )

  return (
    <form onSubmit={submit} className="rounded-2xl border border-neutral-200 p-4 space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-neutral-900">{t('teamWb')}</p>
        <p className="text-xs text-neutral-500">{t('teamWbOwnerOnly')}</p>
      </div>

      <label className="flex items-start gap-3 text-sm font-medium text-neutral-900">
        <input type="checkbox" checked={form.enabled} disabled={busy}
          onChange={(e) => set('enabled', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-900" />
        <span>{t('wbModeOn')}</span>
      </label>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-neutral-900 mb-1">{t('teamWbAnalysis')}</legend>
        {check('use_agenda', t('teamWbAgenda'))}
        {check('use_messages', t('teamWbMessages'))}
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="tw-threshold" className="block text-sm font-medium text-neutral-900">{t('teamWbThreshold')}</label>
        <p className="text-xs text-neutral-500">{t('teamWbThresholdHint')}</p>
        <input id="tw-threshold" type="number" min={1} max={12} step={0.5} value={form.meeting_hours_alert} disabled={busy}
          onChange={(e) => set('meeting_hours_alert', e.target.value)}
          className="w-28 rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900" />
      </div>

      {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
      {saved && !err && <p className="text-sm text-neutral-700">{t('wbSaved')}</p>}

      <button type="submit" disabled={busy || (form.enabled && !sourcesOk)}
        className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('teamWbSave')}</button>

      <AnalysisLog log={log} locale={locale} />
    </form>
  )
}

// Shown in the team chat while the team analysis is on: the sources, and the member's own opt-out.
export function TeamWellbeingNotice({ calendarId, userId }) {
  const { t } = useI18n()
  const [team, setTeam] = useState(null)
  const [excluded, setExcluded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    getTeamWellbeing(calendarId).then(setTeam).catch(() => setTeam(null))
    getMyWellbeingOptout(calendarId, userId).then(setExcluded).catch(() => {})
  }, [calendarId, userId])

  if (!team?.enabled) return null

  async function toggle() {
    setBusy(true); setErr(null)
    try { await setMyWellbeingOptout(calendarId, userId, !excluded); setExcluded(!excluded) }
    catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50 space-y-2">
      <p className="text-xs text-neutral-700">{t('teamWbBanner')}</p>
      <p className="text-xs text-neutral-500">
        {[team.use_agenda && t('teamWbAgenda'), team.use_messages && t('teamWbMessages')].filter(Boolean).join(' · ')}
      </p>
      {team.use_messages && (
        <label className="flex items-start gap-2 text-xs text-neutral-800">
          <input type="checkbox" checked={excluded} disabled={busy} onChange={toggle}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-neutral-900" />
          <span>
            <span className="block">{t('teamWbOptOut')}</span>
            <span className="block text-neutral-500 mt-0.5">{excluded ? t('teamWbOptOutDone') : t('teamWbOptOutHint')}</span>
          </span>
        </label>
      )}
      {err && <p className="text-xs font-medium text-neutral-900">{err}</p>}
    </div>
  )
}

// Owner journal: when the analysis ran, what it read, and whether a group message was posted. Counts only.
export function AnalysisLog({ log, locale }) {
  const { t } = useI18n()
  if (log === null) return null
  return (
    <details className="rounded-xl border border-neutral-100 p-3">
      <summary className="cursor-pointer text-sm font-medium text-neutral-900">{t('wbLogTitle')}</summary>
      <p className="mt-2 text-xs text-neutral-500">{t('wbLogNote')}</p>
      {log.length === 0 ? <p className="mt-2 text-xs text-neutral-500">{t('wbLogEmpty')}</p> : (
        <ul className="mt-2 divide-y divide-neutral-100 text-xs text-neutral-700">
          {log.map((r, i) => (
            <li key={i} className="py-2 space-y-0.5">
              <p className="text-neutral-900">{new Date(r.ran_at).toLocaleString(locale || undefined)}</p>
              <p>{r.sources} · {r.messages_read} {t('wbLogMessages')} · {r.load_days} {t('wbLogDays')} · {r.crisis_alerts} {t('wbLogPrivate')}</p>
              <p className="text-neutral-500">{r.posted ? t('wbLogPosted') : t('wbLogSilent')}</p>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
