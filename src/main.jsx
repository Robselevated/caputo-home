import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { recoverFromChunkError, looksLikeChunkError } from './lib/recovery'

// Defer the SW update check so it never competes with first paint.
// VitePWA's autoUpdate handles activation; this just nudges an update fetch.
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
