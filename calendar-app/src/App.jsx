import { useState } from 'react'

const TABS = ['Month', 'Week', 'Day', 'Events']

// Monochrome palette: black, white and grey shades only.
const EVENTS = [
  { id: 1, title: 'Team standup', time: '09:00 – 09:30', tone: 'bg-neutral-900', date: 15 },
  { id: 2, title: 'Design review', time: '11:00 – 12:00', tone: 'bg-neutral-600', date: 15 },
  { id: 3, title: 'Focus time', time: '14:00 – 16:00', tone: 'bg-neutral-400', date: 15 },
  { id: 4, title: 'Client call', time: '10:00 – 10:45', tone: 'bg-neutral-800', date: 16 },
  { id: 5, title: 'Lunch', time: '12:30 – 13:30', tone: 'bg-neutral-300', date: 18 },
]

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i)
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// September 2026: 1st is a Tuesday (Monday-first grid)
function monthCells() {
  const cells = [null]
  for (let d = 1; d <= 30; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return cells
}

function EventDetail({ event, onClose }) {
  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 space-y-4 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${event.tone}`} />
          <h3 className="text-lg md:text-xl font-semibold text-neutral-900">{event.title}</h3>
        </div>
        <p className="text-sm text-neutral-600">{event.date} septembre · {event.time}</p>
        <p className="text-xs text-neutral-400">Répétition : aucune · Rappel : 10 min avant</p>
        <div className="flex gap-2">
          <button className="flex-1 py-2 rounded-xl bg-neutral-100 text-neutral-900 text-sm hover:bg-neutral-200">Modifier</button>
          <button className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm hover:bg-neutral-700">Supprimer</button>
        </div>
        <button onClick={onClose} className="w-full text-sm text-neutral-500 hover:text-neutral-800">Fermer</button>
      </div>
    </div>
  )
}

function MonthView({ selected, setSelected, onOpen }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <section>
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
                className={`relative mx-auto h-9 w-9 md:h-11 md:w-11 rounded-full text-sm md:text-base transition ${
                  isSel ? 'bg-neutral-900 text-white' : 'text-neutral-800 hover:bg-neutral-100'
                } ${!d ? 'invisible' : ''}`}
              >
                {d}
                {has && !isSel && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-neutral-500" />
                )}
              </button>
            )
          })}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Prochains événements</h2>
        <ul className="space-y-2">
          {EVENTS.map((e) => (
            <li key={e.id}>
              <button onClick={() => onOpen(e)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-left">
                <span className={`h-8 w-1 rounded-full ${e.tone}`} />
                <span className="flex-1">
                  <span className="block text-sm text-neutral-900">{e.title}</span>
                  <span className="block text-xs text-neutral-500">{e.date} sept. · {e.time}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Timeline({ dayEvents, onOpen }) {
  return (
    <ol>
      {HOURS.map((h) => {
        const evs = dayEvents.filter((e) => parseInt(e.time.slice(0, 2)) === h)
        return (
          <li key={h} className="flex gap-3 min-h-[56px] border-t border-neutral-100">
            <span className="w-12 pt-1 text-xs text-neutral-400">{String(h).padStart(2, '0')}:00</span>
            <div className="flex-1 space-y-1 py-1">
              {evs.map((e) => (
                <button key={e.id} onClick={() => onOpen(e)} className={`w-full text-left rounded-lg px-3 py-1.5 text-xs md:text-sm text-white ${e.tone}`}>
                  {e.title} · {e.time}
                </button>
              ))}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function App() {
  const [tab, setTab] = useState('Month')
  const [selected, setSelected] = useState(15)
  const [openEvent, setOpenEvent] = useState(null)

  const dayEvents = EVENTS.filter((e) => e.date === selected)

  return (
    <div className="min-h-screen bg-neutral-200 flex items-stretch md:items-center justify-center md:p-6">
      <div className="relative w-full md:max-w-3xl lg:max-w-5xl md:h-[min(90vh,820px)] min-h-screen md:min-h-0 bg-white md:rounded-[32px] md:shadow-xl overflow-hidden flex flex-col">
        <header className="px-5 md:px-10 pt-6 md:pt-8 pb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs md:text-sm text-neutral-500">Septembre 2026</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">
              {tab === 'Day' ? `${selected} septembre` : 'Calendrier'}
            </h1>
          </div>
          <nav className="hidden sm:block">
            <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}
                  className={`px-4 py-1.5 text-sm rounded-lg transition ${tab === t ? 'bg-white shadow text-neutral-900 font-medium' : 'text-neutral-500 hover:text-neutral-800'}`}>
                  {t}
                </button>
              ))}
            </div>
          </nav>
        </header>

        <nav className="sm:hidden px-5">
          <div className="grid grid-cols-4 bg-neutral-100 rounded-xl p-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}
                className={`py-1.5 text-sm rounded-lg transition ${tab === t ? 'bg-white shadow text-neutral-900 font-medium' : 'text-neutral-500'}`}>
                {t}
              </button>
            ))}
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto px-5 md:px-10 py-4 md:py-6">
          {tab === 'Month' && <MonthView selected={selected} setSelected={setSelected} onOpen={setOpenEvent} />}
          {(tab === 'Day' || tab === 'Week') && (
            <div className={tab === 'Week' ? 'md:grid md:grid-cols-2 md:gap-6' : ''}>
              <Timeline dayEvents={dayEvents} onOpen={setOpenEvent} />
              {tab === 'Week' && <Timeline dayEvents={EVENTS.filter((e) => e.date === 16)} onOpen={setOpenEvent} />}
            </div>
          )}
          {tab === 'Events' && (
            <ul className="grid gap-2 md:grid-cols-2 md:gap-3">
              {EVENTS.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setOpenEvent(e)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-left">
                    <span className={`h-3 w-3 rounded-full ${e.tone}`} />
                    <span className="text-sm text-neutral-900">{e.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </main>

        {openEvent && <EventDetail event={openEvent} onClose={() => setOpenEvent(null)} />}
      </div>
    </div>
  )
}
