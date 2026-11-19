import React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root.jsx'
import { I18nProvider } from './i18n/index.jsx'
import './index.css'
import { installErrorReporter } from './lib/errorReporter.js'
import ErrorBoundary from './ErrorBoundary.jsx'
import { reloadOnceForStaleChunk } from './lib/chunkReload.js'

// Unexpected errors of the app are reported for monitoring (scrubbed on the server).
installErrorReporter({ url: import.meta.env.VITE_SUPABASE_URL, anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY })

// Vite's own signal that a file of the previous build is gone (preload failed): reload once instead of failing.
window.addEventListener('vite:preloadError', (event) => { if (reloadOnceForStaleChunk()) event.preventDefault() })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <Root />
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
