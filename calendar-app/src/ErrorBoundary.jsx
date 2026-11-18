import { Component } from 'react'
import { reportClientError } from './lib/errorReporter.js'

// Last line of defence: if a screen crashes (for example after a browser extension or page translation changed the
// page under React), the visitor gets a way out instead of a blank page, and the error reaches monitoring.
// Plain text in French and English: this must work even when the language system itself is the problem.
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error, info) {
    reportClientError('boundary', error?.message, `${error?.stack ?? ''}\n${info?.componentStack ?? ''}`)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-6" role="alert" data-error-screen>
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl space-y-4 text-center">
          <p className="text-base font-semibold text-neutral-900">Un problème est survenu. / Something went wrong.</p>
          <p className="text-sm text-neutral-600">Rechargez la page. Si vous utilisez la traduction automatique du navigateur, désactivez-la pour Collyo : l’application existe en six langues.<br />Reload the page. If your browser translates the page, turn it off for Collyo: the app comes in six languages.</p>
          <button type="button" onClick={() => window.location.reload()} className="w-full py-2.5 rounded-2xl bg-neutral-900 text-sm font-medium text-white">Recharger / Reload</button>
        </div>
      </div>
    )
  }
}
