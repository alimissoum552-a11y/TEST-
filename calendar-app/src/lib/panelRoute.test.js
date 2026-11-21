import { describe, it, expect } from 'vitest'
import { panelFromHash, hashForPanels } from './panelRoute.js'

describe('panel routes', () => {
  it('reads the open panel from the hash', () => {
    expect(panelFromHash('#/assistant')).toBe('assistant')
    expect(panelFromHash('#/chat')).toBe('chat')
    expect(panelFromHash('#/pricing')).toBeNull()
    expect(panelFromHash('')).toBeNull()
  })
  it('writes the hash for the open panel', () => {
    expect(hashForPanels({ assistant: true })).toBe('#/assistant')
    expect(hashForPanels({ chat: true })).toBe('#/chat')
    expect(hashForPanels({})).toBe('')
  })
})
