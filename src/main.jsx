import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Defer the SW update check so it never competes with first paint.
// VitePWA's autoUpdate handles activation; this just nudges an update fetch.
if ('serviceWorker' in navigator) {
  setTimeout(() => {
    navigator.serviceWorker.ready
      .then((reg) => reg.update())
      .catch(() => {})
  }, 5000)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
