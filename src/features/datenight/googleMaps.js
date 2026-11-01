// Loads the Google Maps JavaScript API once and hands back `google.maps`.
//
// VITE_GOOGLE_MAPS_BROWSER_KEY ships in the bundle on purpose: it is a browser
// key locked to this app's domains by HTTP referrer restriction in Google
// Cloud Console, and to the Maps JavaScript API only. The server-side Places
// key stays in Netlify Functions and is never used here.
//
// VITE_GOOGLE_MAPS_MAP_ID is a Map ID from Google Maps Platform > Map
// Management; Advanced Markers need one. DEMO_MAP_ID works for local
// development until a real one is set.

const CALLBACK = '__caputoGoogleMapsReady'

let pending = null
let authFailed = false
const authListeners = new Set()

export const hasMapsKey = () => Boolean(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY)
export const mapId = () => import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

// Google calls this (no arguments) when the key is refused: wrong referrer,
// API not enabled, billing off. It fires after the script has loaded, usually
// as the first map is created, so it cannot be a rejection of loadGoogleMaps.
if (typeof window !== 'undefined') {
  window.gm_authFailure = () => {
    authFailed = true
    for (const cb of authListeners) cb()
  }
}

// Subscribe to key rejection; returns an unsubscribe. A subscriber arriving
// after the failure hears about it immediately.
export function onAuthFailure(cb) {
  authListeners.add(cb)
  if (authFailed) cb()
  return () => authListeners.delete(cb)
}

export function loadGoogleMaps() {
  if (pending) return pending
  const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY
  if (!key) return Promise.reject(new Error('Google Maps key is not set'))

  pending = new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) { resolve(window.google.maps); return }

    window[CALLBACK] = () => {
      delete window[CALLBACK]
      resolve(window.google.maps)
    }

    const params = new URLSearchParams({ key, v: 'weekly', loading: 'async', callback: CALLBACK })
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    script.async = true
    script.onerror = () => {
      pending = null
      script.remove()
      reject(new Error('Google Maps failed to load'))
    }
    document.head.appendChild(script)
  })
  return pending
}
