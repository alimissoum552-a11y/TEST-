// Sends unexpected errors of the web app to the `report-error` function (docs/OPERATIONS.md, "Monitoring").
// At most 10 reports per page load, never twice the same message; failures to report are ignored.
const MAX = 10

export function errorKey(message, stack) {
  return `${String(message ?? '').slice(0, 200)}|${String(stack ?? '').split('\n')[1] ?? ''}`
}

export function installErrorReporter({ url, anonKey, release = '', fetchImpl = (...a) => fetch(...a), target = window } = {}) {
  if (!url || !anonKey) return () => {}
  const seen = new Set()
  const send = (kind, message, stack) => {
    const key = errorKey(message, stack)
    if (seen.has(key) || seen.size >= MAX) return
    seen.add(key)
    fetchImpl(`${url}/functions/v1/report-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey },
      body: JSON.stringify({ kind, message: String(message ?? '').slice(0, 500), stack: String(stack ?? '').slice(0, 800), route: (target.location?.hash || '').split('?')[0], release }),
      keepalive: true,
    }).catch(() => {})
  }
  const onError = (e) => send('error', e?.message, e?.error?.stack)
  const onRejection = (e) => send('rejection', e?.reason?.message ?? e?.reason, e?.reason?.stack)
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return () => { target.removeEventListener('error', onError); target.removeEventListener('unhandledrejection', onRejection) }
}
