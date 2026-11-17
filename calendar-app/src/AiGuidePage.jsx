import { AI_GUIDE } from './aiGuide.js'
import { useI18n } from './i18n/index.jsx'

// Public guide: what each AI does, what you can ask, and who controls what.
export default function AiGuidePage({ onBack }) {
  const { t, lang } = useI18n()
  const L = AI_GUIDE[lang] || AI_GUIDE.en
  const th = 'text-start align-top px-3 py-2 text-xs font-medium uppercase tracking-wide text-neutral-500'
  const td = 'align-top px-3 py-3 text-sm text-neutral-700'

  return (
    <div className="min-h-screen bg-neutral-200 flex justify-center p-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <article className="w-full max-w-3xl bg-white rounded-3xl shadow-xl p-6 md:p-10 space-y-8">
        <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-900">← {t('back')}</button>

        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">{L.title}</h1>
          <p className="text-sm leading-relaxed text-neutral-600">{L.intro}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">{L.compareTitle}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse">
              <thead>
                <tr className="border-b border-neutral-200">
                  {L.compareHead.map((h, i) => <th key={i} className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {L.compare.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-100 align-top">
                    <th scope="row" className="text-start align-top px-3 py-3 text-sm font-medium text-neutral-900">{row[0]}</th>
                    <td className={td}>{row[1]}</td>
                    <td className={td}>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">{L.commandsTitle}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse">
              <thead>
                <tr className="border-b border-neutral-200">
                  {L.commandsHead.map((h, i) => <th key={i} className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {L.commands.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-100 align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-neutral-500">{row[0]}</td>
                    <td className="px-3 py-3 text-sm text-neutral-900">{row[1]}</td>
                    <td className={td}>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">{L.permsTitle}</h2>
          <ul className="space-y-3">
            {L.perms.map((p) => (
              <li key={p.h} className="rounded-2xl bg-neutral-50 p-4">
                <p className="text-sm font-medium text-neutral-900">{p.h}</p>
                <p className="mt-1 text-sm text-neutral-600">{p.p}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-neutral-900">{L.notesTitle}</h2>
          <ul className="list-disc ps-5 space-y-1">
            {L.notes.map((n, i) => <li key={i} className="text-sm text-neutral-700">{n}</li>)}
          </ul>
        </section>
      </article>
    </div>
  )
}
