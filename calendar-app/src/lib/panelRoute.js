// The open panel is kept in the URL hash so a refresh (or a shared link) reopens the same section.
export const PANEL_HASH = { assistant: '#/assistant', chat: '#/chat' }

export function panelFromHash(hash) {
  if (hash === PANEL_HASH.assistant) return 'assistant'
  if (hash === PANEL_HASH.chat) return 'chat'
  return null
}

export function hashForPanels({ assistant, chat }) {
  if (assistant) return PANEL_HASH.assistant
  if (chat) return PANEL_HASH.chat
  return ''
}
