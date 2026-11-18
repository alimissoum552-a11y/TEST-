import { describe, it, expect } from 'vitest'
import { installErrorReporter } from './errorReporter.js'

function fakeTarget() {
  const handlers = {}
  return { location: { hash: '#/pricing?x=1' }, addEventListener: (t, h) => { handlers[t] = h }, removeEventListener: (t) => { delete handlers[t] }, fire: (t, e) => handlers[t]?.(e), handlers }
}

describe('installErrorReporter', () => {
  it('reports an error once, with the route but not the query', () => {
    const calls = []; const target = fakeTarget()
    installErrorReporter({ url: 'https://x.supabase.co', anonKey: 'k', target, fetchImpl: (u, o) => { calls.push([u, JSON.parse(o.body)]); return Promise.resolve() } })
    target.fire('error', { message: 'boom', error: { stack: 'Error: boom\n at a.js:1' } })
    target.fire('error', { message: 'boom', error: { stack: 'Error: boom\n at a.js:1' } })
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('https://x.supabase.co/functions/v1/report-error')
    expect(calls[0][1]).toMatchObject({ kind: 'error', message: 'boom', route: '#/pricing' })
  })
  it('stops after 10 different errors and handles rejections', () => {
    let n = 0; const target = fakeTarget()
    installErrorReporter({ url: 'u', anonKey: 'k', target, fetchImpl: () => { n++; return Promise.resolve() } })
    target.fire('unhandledrejection', { reason: new Error('nope') })
    for (let i = 0; i < 20; i++) target.fire('error', { message: 'e' + i })
    expect(n).toBe(10)
  })
  it('does nothing without a backend', () => {
    const target = fakeTarget()
    installErrorReporter({ target })
    expect(Object.keys(target.handlers)).toHaveLength(0)
  })
})
