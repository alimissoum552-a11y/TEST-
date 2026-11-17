import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.jsx'
import { getWellbeingSettings, saveWellbeingSettings, listMyWellbeingAlerts, markWellbeingAlertRead } from './lib/api.js'

const DEFAULTS = {
  mode_enabled: false,
  age_band: null,
  profession: '',
  family_status: null,
  checkin_enabled: false,
  mood_in_checkin: false,
  breaks_enabled: false,
  agenda_analysis: false,
}

const AGE_BANDS = ['18-29', '30-44', '45-59', '60+']
const FAMILY = [['alone', 'wbFamilyAlone'], ['couple', 'wbFamilyCouple'], ['family_with_children', 'wbFamilyKids']]

const field = 'w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 bg-white'

// Emergency information shown in the well-being panel and in the personal assistant.
// Numbers follow international standards: 112 (EU), 911 (North America), 999 (UK) and a directory of helplines.
export function CrisisResources() {
  const { t } = useI18n()
  return (
    <div role="note" className="rounded-2xl border border-neutral-300 bg-neutral-50 p-4 space-y-2">
      <p className="text-sm font-semibold text-neutral-900">{t('wbCrisisTitle')}</p>
      <p className="text-xs text-neutral-700">{t('wbCrisisText')}</p>
      <p className="text-xs text-neutral-500">{t('wbCrisisEmergency')}</p>
      <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer"
        className="inline-block text-xs text-neutral-900 underline underline-offset-2">{t('wbCrisisFind')}</a>
    </div>
  )
}

// Personal well-being settings. Each optional item explains why it is asked and how it is used.
export default function WellbeingPanel({ user, onClose, onSaved }) {
  const { t } = useI18n()
  const [form, setForm] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    listMyWellbeingAlerts(user.id).then(setAlerts).catch(() => {})
  }, [user.id])

  useEffect(() => {
    getWellbeingSettings(user.id)
      .then((row) => { if (row) setForm({ ...DEFAULTS, ...row, profession: row.profession || '' }) })
      .catch((ex) => setErr(ex.message))
      .finally(() => setLoading(false))
  }, [user.id])

  const set = (key, value) => { setSaved(false); setForm((f) => ({ ...f, [key]: value })) }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const patch = { ...form, profession: form.profession.trim() || null,
        // Sub-option and dependent permissions are meaningless when the master switch is off.
        mood_in_checkin: form.checkin_enabled && form.mood_in_checkin }
      const row = await saveWellbeingSettings(user.id, patch)
      setForm({ ...DEFAULTS, ...row, profession: row.profession || '' })
      setSaved(true)
      onSaved?.(row)
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  const check = (key, label, hint, disabled = false) => (
    <label className={`flex items-start gap-3 text-sm ${disabled ? 'text-neutral-400' : 'text-neutral-800'}`}>
      <input type="checkbox" checked={!!form[key]} disabled={disabled || busy}
        onChange={(e) => set(key, e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-900" />
      <span>
        <span className="block">{t(label)}</span>
        {hint && <span className="block text-xs text-neutral-500 mt-0.5">{t(hint)}</span>}
      </span>
    </label>
  )

  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-xl space-y-5 max-h-[90%] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-neutral-900">{t('wbTitle')}</h3>
          <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">{t('close')}</button>
        </div>
        <p className="text-xs text-neutral-600">{t('wbIntro')}</p>

        {alerts.some((a) => !a.read_at) && (
          <section className="rounded-2xl border border-neutral-900 p-4 space-y-3" aria-label={t('wbAlertsTitle')}>
            <p className="text-sm font-semibold text-neutral-900">{t('wbAlertsTitle')}</p>
            {alerts.filter((a) => !a.read_at).map((a) => (
              <div key={a.id} className="space-y-2">
                <p className="text-xs text-neutral-700">{t('wbAlertCrisis')}</p>
                <CrisisResources />
                <button type="button" onClick={async () => { await markWellbeingAlertRead(a.id).catch(() => {}); setAlerts((list) => list.map((x) => x.id === a.id ? { ...x, read_at: new Date().toISOString() } : x)) }}
                  className="text-xs text-neutral-900 underline underline-offset-2">{t('wbAlertDismiss')}</button>
              </div>
            ))}
          </section>
        )}

        {loading ? <p className="text-sm text-neutral-400">…</p> : (
          <>
            <label className="flex items-start gap-3 text-sm text-neutral-900 font-medium">
              <input type="checkbox" checked={form.mode_enabled} disabled={busy}
                onChange={(e) => set('mode_enabled', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-900" />
              <span>
                <span className="block">{t('wbModeOn')}</span>
                <span className="block text-xs font-normal text-neutral-500 mt-0.5">{t('wbModeHint')}</span>
              </span>
            </label>

            <fieldset className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="wb-age" className="block text-sm font-medium text-neutral-900">{t('wbAge')}</label>
                <p className="text-xs text-neutral-500">{t('wbAgeWhy')}</p>
                <select id="wb-age" className={field} value={form.age_band || ''} disabled={busy}
                  onChange={(e) => set('age_band', e.target.value || null)}>
                  <option value="">{t('wbAgeNone')}</option>
                  {AGE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="wb-profession" className="block text-sm font-medium text-neutral-900">{t('wbProfession')}</label>
                <p className="text-xs text-neutral-500">{t('wbProfessionWhy')}</p>
                <input id="wb-profession" className={field} maxLength={60} value={form.profession} disabled={busy}
                  onChange={(e) => set('profession', e.target.value)} />
              </div>

              <div className="space-y-1">
                <label htmlFor="wb-family" className="block text-sm font-medium text-neutral-900">{t('wbFamily')}</label>
                <p className="text-xs text-neutral-500">{t('wbFamilyWhy')}</p>
                <select id="wb-family" className={field} value={form.family_status || ''} disabled={busy}
                  onChange={(e) => set('family_status', e.target.value || null)}>
                  <option value="">{t('wbFamilyNone')}</option>
                  {FAMILY.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
                </select>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              {check('checkin_enabled', 'wbCheckin')}
              {check('mood_in_checkin', 'wbMood', null, !form.checkin_enabled)}
              {check('breaks_enabled', 'wbBreaks', 'wbBreaksHint')}
              {check('agenda_analysis', 'wbAgendaAnalysis', 'wbAgendaAnalysisHint')}
            </fieldset>

            {err && <p className="text-sm font-medium text-neutral-900">{err}</p>}
            {saved && !err && <p className="text-sm text-neutral-700">{t('wbSaved')}</p>}

            <button type="submit" disabled={busy}
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-50">{t('wbSave')}</button>

            <CrisisResources />
          </>
        )}
      </form>
    </div>
  )
}
