import { useCallback, useEffect, useRef, useState } from 'react'
import AiAvatar from './AiAvatar.jsx'
import { useI18n, LanguageButton, LanguageSelect } from './i18n/index.jsx'
import { LANDING } from './landing.js'

// Public landing page for visitors who are not signed in. The only links are sign-up and sign-in.
// The feature panels are a swipeable carousel: one panel leaves while the next arrives, like turning the
// pages of a book. Native horizontal scroll with snap points does the swiping; a light 3D transform does the
// page-turn look. Demos use fixed sample data;
// nothing reads or writes user data. Colours are the application's greys only.

// The legal labels come from the app dictionary in sentence case; the footer shows them with a capital.
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ---- Demos ----

// November 2026 starts on a Sunday: six empty cells before the 1st in a Monday-first grid.
const SLOTS = { 3: '09:00', 12: '14:00', 16: '09:00', 18: '11:30' }

function CalendarDemo() {
  const [day, setDay] = useState(16)
  const cells = [...Array(6).fill(null), ...Array.from({ length: 30 }, (_, i) => i + 1)]
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-neutral-400 mb-1">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => d === null ? <span key={i} /> : (
          <button key={i} type="button" onClick={() => setDay(d)} aria-pressed={d === day}
            className={`relative h-8 rounded-xl text-xs transition-colors ${d === day ? 'bg-neutral-900 text-white' : 'text-neutral-800 hover:bg-neutral-100'}`}>
            {d}
            {SLOTS[d] && d !== day && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-neutral-500" />}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-500">{SLOTS[day] ? `${day} · ${SLOTS[day]}` : `${day}`}</p>
    </div>
  )
}

function ChatDemo({ L, active }) {
  const script = [
    { who: 'teammate', text: L.chat1 },
    { who: 'you', text: L.chat2 },
    { who: 'ai', text: L.chat3 },
  ]
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!active) { setShown(0); return }
    const id = setTimeout(() => setShown((s) => (s >= script.length ? 0 : s + 1)), shown === 0 ? 400 : 1600)
    return () => clearTimeout(id)
  }, [shown, active])
  return (
    <ul className="space-y-2 text-sm min-h-[9rem]">
      {script.slice(0, shown).map((m, i) => (
        <li key={i} className={`max-w-[88%] rounded-2xl px-3 py-2 ${m.who === 'you' ? 'ms-auto bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
          {m.text.split(/(@\w+)/g).map((p, j) => p.startsWith('@')
            ? <strong key={j} className="font-semibold underline underline-offset-2">{p}</strong>
            : <span key={j}>{p}</span>)}
        </li>
      ))}
      {active && shown < script.length && <li className="text-neutral-400 motion-safe:animate-pulse text-xs">…</li>}
    </ul>
  )
}

function AiDemo({ L }) {
  const [state, setState] = useState('idle') // idle | thinking | done
  useEffect(() => {
    if (state !== 'thinking') return
    const id = setTimeout(() => setState('done'), 700)
    return () => clearTimeout(id)
  }, [state])
  const hours = Array.from({ length: 10 }, (_, i) => 9 + i)
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input readOnly value={L.aiQ} aria-label={L.aiQ} className="flex-1 min-w-0 rounded-xl border border-neutral-200 px-3 py-2 text-xs bg-neutral-50" />
        <button type="button" onClick={() => setState('thinking')} className="shrink-0 px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs">{L.aiAsk}</button>
      </div>
      <div className="grid grid-cols-10 gap-1 h-16 items-end" aria-hidden="true">
        {hours.map((h) => {
          const free = !(h === 12 || h === 15)
          const slot = h === 10
          return (
            <div key={h} className={`rounded-md h-full transition-all duration-500 ${slot && state === 'done' ? 'bg-neutral-900' : free ? 'bg-neutral-100' : 'bg-neutral-300'}`} />
          )
        })}
      </div>
      <p className="text-xs text-neutral-600 min-h-[1rem]" role="status">{state === 'thinking' ? '…' : state === 'done' ? L.aiA : ''}</p>
    </div>
  )
}

function RemindDemo({ L }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!on) return
    const id = setTimeout(() => setOn(false), 4000)
    return () => clearTimeout(id)
  }, [on])
  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOn(true)} className="w-full px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs text-neutral-900">{L.remindBtn}</button>
      <div role="status" className={`rounded-2xl bg-neutral-900 text-white px-4 py-3 text-xs flex items-center gap-2 transition-all duration-300 ${on ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        <span className="h-2 w-2 rounded-full bg-white motion-safe:animate-pulse" aria-hidden="true" />
        {L.remindToast}
      </div>
    </div>
  )
}

function ShareDemo({ L }) {
  const roles = Object.entries(L.roles)
  const [active, setActive] = useState(roles[0][0])
  const label = (txt) => txt.split(':')[0]
  const desc = (txt) => txt.split(':').slice(1).join(':').trim()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group">
        {roles.map(([k, v]) => (
          <button key={k} type="button" onClick={() => setActive(k)} aria-pressed={active === k}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${active === k ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
            {label(v)}
          </button>
        ))}
      </div>
      <p className="text-xs text-neutral-700 min-h-[2.5rem]">{desc(L.roles[active])}</p>
    </div>
  )
}

function ConnectorDemo({ L }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/mcp` : ''
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* unavailable */ }
  }
  return (
    <div className="flex gap-2">
      <code className="flex-1 min-w-0 truncate rounded-xl border border-neutral-200 px-3 py-2 text-xs bg-neutral-50">{url}</code>
      <button type="button" onClick={copy} className="shrink-0 px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs">{copied ? L.copied : L.copy}</button>
    </div>
  )
}

// Hero visual: a day preview (times only). The focus moves from one row to the next on its own.
const HERO_ROWS = [['09:00', '10:00'], ['10:00', '11:00'], ['14:00', '15:30'], ['17:00', '17:30']]

// The focused row follows the page scroll: every 90px of scrolling moves the focus to the next row.
function HeroVisual() {
  const [focus, setFocus] = useState(0)
  useEffect(() => {
    const onScroll = () => setFocus(Math.floor(window.scrollY / 90) % HERO_ROWS.length)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="space-y-2" aria-hidden="true" data-hero-focus={focus}>
      {HERO_ROWS.map(([a, b], i) => {
        const on = i === focus
        return (
          <div key={i} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-500 ${on ? 'bg-white ring-2 ring-neutral-900 shadow-md' : 'bg-neutral-50 ring-1 ring-transparent'}`}>
            <span className={`w-28 shrink-0 text-xs ${on ? 'text-neutral-900 font-medium' : 'text-neutral-500'}`}>{a} – {b}</span>
            <span className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${on ? 'bg-neutral-900' : 'bg-neutral-300'}`} />
          </div>
        )
      })}
    </div>
  )
}

// ---- Carousel ----

// Panels scroll horizontally with snap points (finger swipe, trackpad, keyboard).
// On scroll, each panel is rotated and faded according to its distance from the centre: the page-turn look.
function Carousel({ panels, label, startIndex = 0 }) {
  const trackRef = useRef(null)
  const indexRef = useRef(0)
  const [index, setIndex] = useState(0)
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl'

  const paint = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const centre = rect.left + rect.width / 2
    let best = 0, bestDist = Infinity
    Array.from(track.children).forEach((el, i) => {
      const r = el.getBoundingClientRect()
      const d = (r.left + r.width / 2 - centre) / rect.width // -1 .. 1
      const abs = Math.min(1, Math.abs(d))
      if (abs < bestDist) { bestDist = abs; best = i }
      if (reduceMotion()) { el.style.transform = ''; el.style.opacity = ''; return }
      // Turn away from the centre: the leaving page folds, the arriving page unfolds.
      el.style.transform = `perspective(1200px) rotateY(${(-d * 28).toFixed(2)}deg) scale(${(1 - abs * 0.08).toFixed(3)})`
      el.style.opacity = String(1 - abs * 0.45)
    })
    indexRef.current = best
    setIndex(best)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let raf = 0
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint) }
    // Centre the first panel on load (the browser starts at the scroll origin, not at a snap point).
    const first = track.children[startIndex] ?? track.children[0]
    if (first) {
      // Snapping is paused while placing the track, so the browser cannot pull it to a neighbouring panel.
      const tr = track.getBoundingClientRect(), fr = first.getBoundingClientRect()
      track.style.scrollSnapType = 'none'
      track.scrollLeft += (fr.left + fr.width / 2) - (tr.left + tr.width / 2)
      requestAnimationFrame(() => { track.style.scrollSnapType = '' })
    }
    paint()
    track.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { track.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [paint])

  // Horizontal move only: never scrolls the page itself (scrollIntoView could).
  const goTo = (i) => {
    const track = trackRef.current
    const el = track?.children[Math.max(0, Math.min(panels.length - 1, i))]
    if (!track || !el) return
    const tr = track.getBoundingClientRect(), er = el.getBoundingClientRect()
    track.scrollBy({ left: (er.left + er.width / 2) - (tr.left + tr.width / 2), behavior: reduceMotion() ? 'auto' : 'smooth' })
  }
  const onKey = (e) => {
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
    const back = rtl ? 'ArrowRight' : 'ArrowLeft'
    if (e.key === forward) { e.preventDefault(); goTo(indexRef.current + 1) }
    if (e.key === back) { e.preventDefault(); goTo(indexRef.current - 1) }
  }

  return (
    <div>
      <div ref={trackRef} tabIndex={0} onKeyDown={onKey} role="region" aria-roledescription="carousel" aria-label={label(index + 1, panels.length)}
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [--panel:72vw] md:[--panel:36rem] lg:[--panel:44rem] px-[calc((100%_-_var(--panel))_/_2)] py-4 -my-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 rounded-3xl">
        {panels.map((p, i) => (
          <article key={p.id} aria-roledescription="slide" aria-label={`${i + 1} / ${panels.length}`} aria-hidden={i !== index}
            className="snap-center snap-always shrink-0 w-[var(--panel)] rounded-3xl bg-white p-6 md:p-8 shadow-xl ring-1 ring-neutral-200 will-change-transform">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold bg-neutral-900 text-white">{p.sparkle ? <AiAvatar size="sm" tone="light" /> : i + 1}</span>
            <h3 className="mt-3 text-xl font-semibold text-neutral-900">{p.title}</h3>
            <p className="mt-1 text-sm text-neutral-600">{p.text}</p>
            <div className="mt-5">{p.render(i === index)}</div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default function Landing() {
  const { lang, t } = useI18n()
  const L = LANDING[lang] || LANDING.en
  const [langOpen, setLangOpen] = useState(false)
  const [step, setStep] = useState(null)

  const panels = [
    { id: 'calendar', title: L.calendar[0], text: L.calendar[1], render: () => <CalendarDemo /> },
    { id: 'team', title: L.team[0], text: L.team[1], render: (active) => <ChatDemo L={L} active={active} /> },
    { id: 'ai', title: L.ai[0], text: L.ai[1], sparkle: true, render: () => <AiDemo L={L} /> },
    { id: 'reminders', title: L.reminders[0], text: L.reminders[1], render: () => <RemindDemo L={L} /> },
    { id: 'share', title: L.share[0], text: L.share[1], render: () => <ShareDemo L={L} /> },
    { id: 'connector', title: L.connector[0], text: L.connector[1], render: () => <ConnectorDemo L={L} /> },
  ]

  const cta = 'w-44 text-center px-5 py-3 rounded-2xl bg-white ring-1 ring-neutral-300 text-sm font-medium text-neutral-900 hover:bg-neutral-50'

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 overflow-x-hidden">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 max-w-6xl mx-auto">
        <span className="text-lg font-semibold tracking-tight">Collyo</span>
        <div className="relative">
          <LanguageButton open={langOpen} onToggle={() => setLangOpen((o) => !o)} />
          {langOpen && <LanguageSelect onPick={() => setLangOpen(false)} placement="down" />}
        </div>
      </header>

      <section className="px-6 md:px-10 pt-6 pb-14 md:pt-12 max-w-6xl mx-auto grid gap-10 md:grid-cols-2 md:items-center">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-neutral-200 px-3 py-1 text-xs font-medium text-neutral-800"><span aria-hidden="true">✦</span>{L.eyebrow}</span>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight">{L.title}</h1>
          <p className="text-base md:text-lg text-neutral-600">{L.sub}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-xl ring-1 ring-neutral-200">
          <HeroVisual />
        </div>
      </section>

      <section className="pb-10">
        <Carousel panels={panels} startIndex={panels.findIndex((p) => p.id === 'ai')} label={(i, n) => `${L.cardsTitle} ${i} / ${n}`} />
      </section>

      <section className="px-6 pb-16">
        <div className="flex flex-wrap justify-center gap-3">
          <a href="#/signup" className={cta}>{L.signup}</a>
          <a href="#/signin" className={cta}>{L.signin}</a>
        </div>
      </section>

      <section className="px-6 md:px-10 pb-16 max-w-6xl mx-auto">
        <ol className="grid gap-4 md:grid-cols-3">
          {L.steps.map((s, i) => {
            const on = step === i
            return (
              <li key={i} className="flex">
                <button type="button" onClick={() => setStep(on ? null : i)} aria-pressed={on} data-step={i}
                  className={`w-full h-full min-h-[11rem] flex flex-col text-start rounded-3xl bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] ${on ? 'ring-2 ring-neutral-900 shadow-xl -translate-y-1' : 'ring-1 ring-neutral-200'}`}>
                  <span className={`text-3xl font-semibold transition-colors ${on ? 'text-neutral-900' : 'text-neutral-300'}`}>{String(i + 1).padStart(2, '0')}</span>
                  <p className="mt-3 text-base font-medium text-neutral-900">{s}</p>
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      <footer className="px-6 md:px-10 pb-10 max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-xs text-neutral-500">
        <span>{L.footer}</span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
          <a href="#/ai-guide" className="hover:text-neutral-900 underline-offset-2 hover:underline">{cap(t('aiGuide'))}</a>
          <a href="#/terms?from=landing" className="hover:text-neutral-900 underline-offset-2 hover:underline">{cap(t('termsLink'))}</a>
          <a href="#/privacy?from=landing" className="hover:text-neutral-900 underline-offset-2 hover:underline">{cap(t('privacyLink'))}</a>
          <a href="#/cookies?from=landing" className="hover:text-neutral-900 underline-offset-2 hover:underline">{cap(t('cookiesLink'))}</a>
        </nav>
      </footer>
    </div>
  )
}
