import { useState } from 'react'

const TABS = ['Month', 'Week', 'Day', 'Events']

const EVENTS = [
  { id: 1, title: 'Team standup', time: '09:00 – 09:30', color: 'bg-indigo-500', date: 15 },
  { id: 2, title: 'Design review', time: '11:00 – 12:00', color: 'bg-emerald-500', date: 15 },
  { id: 3, title: 'Focus time', time: '14:00 – 16:00', color: 'bg-amber-400', date: 15 },
  { id: 4, title: 'Client call', time: '10:00 – 10:45', color: 'bg-rose-500', date: 16 },
  { id: 5, title: 'Lunch', time: '12:30 – 13:30', color: 'bg-sky-500', date: 18 },
]

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i)
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// September 2026: 1st is a Tuesday (Monday-first grid)
function monthCells() {
  const leading = 1 // Tuesday -> one blank before Monday-first
  const cells = Array(leading).fill(null)
  for (let d = 1; d <= 30; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return cells
}

export default function App() {
  const [tab, setTab] = useState('Month')
  const [selected, setSelected] = useState(15)
  const [openEvent, setOpenEvent] = useState(null)

  const dayEvents = EVENTS.filter((e) => e.date === selected)

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-[390px] h-[844px] bg-white rounded-[36px] shadow-2xl overflow-hidden flex flex-col relative">
        <header className="px-5 pt-6 pb-3">
          <p className="text-xs text-neutral-500">Septembre 2026</p>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {tab === 'Day' ? `${selected} septembre` : 'Calendrier'}
          </h1>
        </header>

        <nav className="px-5">
          <div className="grid grid-cols-4 bg-neutral-100 rounded-xl p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={`py-1.5 text-sm rounded-lg transition ${
                  tab === t ? 'bg-white shadow text-neutral-900 font-medium' : 'text-neutral-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'Month' && (
            <>
              <div className="grid grid-cols-7 text-center text-xs text-neutral-400 mb-2">
                {DAYS.map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-2 text-center">
                {monthCells().map((d, i) => {
                  const has = d && EVENTS.some((e) => e.date === d)
                  const isSel = d === selected
                  return (
                    <button
                      key={i}
                      disabled={!d}
                      onClick={() => d && setSelected(d)}
                      className={`relative mx-auto h-9 w-9 rounded-full text-sm ${
                        isSel ? 'bg-neutral-900 text-white' : 'text-neutral-800'
                      } ${!d ? 'invisible' : ''}`}
                    >
                      {d}
                      {has && !isSel && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-indigo-500" />
                      )}
                    </button>
                  )
                })}
              </div>
              <h2 className="mt-6 mb-2 text-sm font-medium text-neutral-700">Prochains événements</h2>
              <ul className="space-y-2">
                {EVENTS.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => setOpenEvent(e)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-50 text-left"
                    >
                      <span className={`h-8 w-1 rounded-full ${e.color}`} />
                      <span className="flex-1">
                        <span className="block text-sm text-neutral-900">{e.title}</span>
                        <span className="block text-xs text-neutral-500">
                          {e.date} sept. · {e.time}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {(tab === 'Day' || tab === 'Week') && (
            <ol className="relative">
              {HOURS.map((h) => {
                const evs = dayEvents.filter((e) => parseInt(e.time.slice(0, 2)) === h)
                return (
                  <li key={h} className="flex gap-3 min-h-[56px] border-t border-neutral-100">
                    <span className="w-10 pt-1 text-xs text-neutral-400">{String(h).padStart(2, '0')}:00</span>
                    <div className="flex-1 space-y-1 py-1">
                      {evs.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setOpenEvent(e)}
                          className={`w-full text-left rounded-lg px-2 py-1.5 text-white text-xs ${e.color}`}
                        >
                          {e.title} · {e.time}
                        </button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {tab === 'Events' && (
            <ul className="space-y-2">
              {EVENTS.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => setOpenEvent(e)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-200 text-left"
                  >
                    <span className={`h-3 w-3 rounded-full ${e.color}`} />
                    <span className="text-sm text-neutral-900">{e.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </main>

        {openEvent && (
          <div className="absolute inset-0 flex items-end bg-black/30" onClick={() => setOpenEvent(null)}>
            <div
              className="w-full bg-white rounded-t-3xl p-6 space-y-4"
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${openEvent.color}`} />
                <h3 className="text-lg font-semibold text-neutral-900">{openEvent.title}</h3>
              </div>
              <p className="text-sm text-neutral-600">
                {openEvent.date} septembre · {openEvent.time}
              </p>
              <p className="text-xs text-neutral-400">Répétition : aucune · Rappel : 10 min avant</p>
              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded-xl bg-neutral-100 text-sm">Modifier</button>
                <button className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-sm">Supprimer</button>
              </div>
              <button onClick={() => setOpenEvent(null)} className="w-full text-sm text-neutral-500">
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
