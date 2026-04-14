import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// VitePWA registerType: 'autoUpdate' handles SW lifecycle automatically.
// Just check for updates on load — no manual reload needed.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(reg => reg.update())
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
