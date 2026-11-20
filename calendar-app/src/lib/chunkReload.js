// After a deploy, a page opened earlier still asks for the previous build's files (e.g. Landing-<oldhash>.js),
// which no longer exist: "Failed to fetch dynamically imported module". Reloading once fetches the new build.
// The reload is limited to once a minute per tab, so a real outage cannot cause a reload loop.
const KEY = 'collyo.chunkReloadAt'
const WINDOW_MS = 60_000

const PATTERNS = [
  /Failed to fetch dynamically imported module/i, // Chrome, Edge
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Unable to preload CSS/i, // Vite CSS preload
]

export function isChunkLoadError(error) {
  const message = typeof error === 'string' ? error : error?.message
  return PATTERNS.some((p) => p.test(String(message ?? '')))
}

// Returns true when it triggered a reload, false when one already happened in the last minute (or storage is blocked).
export function reloadOnceForStaleChunk({ storage = globalThis.sessionStorage, reload = () => globalThis.location.reload(), now = Date.now() } = {}) {
  try {
    const last = Number(storage?.getItem(KEY) || 0)
    if (now - last < WINDOW_MS) return false
    storage.setItem(KEY, String(now))
  } catch {
    return false
  }
  reload()
  return true
}
