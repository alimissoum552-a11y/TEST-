import React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root.jsx'
import { I18nProvider } from './i18n/index.jsx'
import './index.css'
import { installErrorReporter } from './lib/errorReporter.js'

// Unexpected errors of the app are reported for monitoring (scrubbed on the server).
installErrorReporter({ url: import.meta.env.VITE_SUPABASE_URL, anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </React.StrictMode>
)
