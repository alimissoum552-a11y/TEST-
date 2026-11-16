import { PAGES, OPERATOR } from './legal.js'
import { useI18n } from './i18n/index.jsx'

// Renders one legal page in the current language, falling back to English.
// kind: 'terms' | 'privacy' | 'cookies'
export default function LegalPage({ kind, onBack }) {
  const { t, lang } = useI18n()
  const content = PAGES[lang] || PAGES.en
  const fallback = PAGES.en
  const title = content.title?.[kind] || fallback.title[kind]
  const sections = content[kind] || fallback[kind]
  return (
    <div className="min-h-screen bg-neutral-200 flex justify-center p-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <article className="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-6 md:p-10 space-y-6">
        <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-900">← {t('back')}</button>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">{title}</h1>
        <p className="text-xs text-neutral-500">{t('lastUpdated')}: {OPERATOR.updated}</p>
        {sections.map((s) => (
          <section key={s.h} className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">{s.h}</h2>
            <p className="text-sm leading-relaxed text-neutral-700">{s.p}</p>
          </section>
        ))}
        <p className="text-xs text-neutral-400">© {OPERATOR.name}</p>
      </article>
    </div>
  )
}
