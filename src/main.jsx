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

// Nudge a background SW update check well after first paint and the initial
// data load (30s, only while visible), and again when connectivity returns.
// The PWA uses registerType 'prompt' (see vite.config.js): the new SW still
// waits for all windows to close before it activates.
if ('serviceWorker' in navigator) {
  const checkForUpdate = () => {
    if (document.visibilityState !== 'visible') return
    navigator.serviceWorker.ready
      .then((reg) => reg.update())
      .catch(() => {})
  }
  setTimeout(checkForUpdate, 30000)
  window.addEventListener('online', checkForUpdate)

  // One-time cleanup of the retired REST response cache (see vite.config.js).
  try {
    if (!localStorage.getItem('sw-rest-cache-purged') && 'caches' in window) {
      caches.delete('supabase-api')
        .then(() => localStorage.setItem('sw-rest-cache-purged', '1'))
        .catch(() => {})
    }
  } catch {
    // storage unavailable: nothing to purge
  }
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
