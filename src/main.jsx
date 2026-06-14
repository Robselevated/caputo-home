import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { recoverFromChunkError, looksLikeChunkError } from './lib/recovery'
import { installResumeHandler } from './lib/sessionManager'

// Re-validate the session and refetch data whenever iOS wakes the backgrounded
// PWA. Installed once at module scope (not in a component) so React StrictMode
// can't double-register the listeners.
installResumeHandler()

// Defer the SW update check so it never competes with first paint. The PWA uses
// registerType 'prompt' (see vite.config.js) — this just nudges an update fetch
// in the background; the new SW still waits for all windows to close to activate.
if ('serviceWorker' in navigator) {
  setTimeout(() => {
    navigator.serviceWorker.ready
      .then((reg) => reg.update())
      .catch(() => {})
  }, 5000)
}

window.addEventListener('error', (event) => {
  if (looksLikeChunkError(event?.message) || looksLikeChunkError(event?.error?.message)) {
    recoverFromChunkError()
  }
})

window.addEventListener('unhandledrejection', (event) => {
  if (looksLikeChunkError(event?.reason?.message) || looksLikeChunkError(event?.reason)) {
    recoverFromChunkError()
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
