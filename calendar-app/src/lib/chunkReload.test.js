import { describe, it, expect, vi } from 'vitest'
import { isChunkLoadError, reloadOnceForStaleChunk } from './chunkReload.js'

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }

describe('stale build files after a deploy', () => {
  it('recognises the module-loading errors of each browser', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://collyo.app/assets/Landing-DimkXFDi.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://collyo.app/assets/App-x.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('useI18n must be used inside I18nProvider'))).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })

  it('reloads once, then not again within a minute', () => {
    const storage = memory(); const reload = vi.fn()
    expect(reloadOnceForStaleChunk({ storage, reload, now: 1_000_000 })).toBe(true)
    expect(reloadOnceForStaleChunk({ storage, reload, now: 1_030_000 })).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(reloadOnceForStaleChunk({ storage, reload, now: 1_070_000 })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does not reload when storage is blocked', () => {
    const reload = vi.fn()
    const storage = { getItem: () => { throw new Error('blocked') }, setItem: () => {} }
    expect(reloadOnceForStaleChunk({ storage, reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
