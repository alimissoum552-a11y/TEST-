import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { useI18n, I18nProvider } from './index.jsx'
import ErrorBoundary from '../ErrorBoundary.jsx'

function Label() {
  const { t, lang } = useI18n()
  return <span>{lang}:{t('back')}</span>
}

describe('language outside the provider', () => {
  it('falls back to English instead of crashing the page', () => {
    expect(renderToString(<Label />)).toBe('<span>en<!-- -->:<!-- -->Back</span>')
  })
  it('still uses the provider when there is one', () => {
    expect(renderToString(<I18nProvider><Label /></I18nProvider>)).toContain('Back')
  })
})

describe('error boundary', () => {
  it('switches to the error screen after an error and renders children otherwise', () => {
    expect(ErrorBoundary.getDerivedStateFromError(new Error('x'))).toEqual({ failed: true })
    expect(renderToString(<ErrorBoundary><span>ok</span></ErrorBoundary>)).toBe('<span>ok</span>')
  })
})
