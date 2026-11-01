import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps, hasMapsKey, onAuthFailure } from './googleMaps'

// Google's own profile for the place (photos, rating, hours, reviews), drawn
// by the Places UI Kit inside the app instead of bouncing out to Google Maps.
// Uses the same browser key as the map; the key needs the Places UI Kit API
// enabled. Name and address are left out because the page already shows them.
// Hidden entirely when there's no key, no place id, or Google refuses the
// request, so the page never shows a broken box.

// Match the app: its fonts, surface, and the Date Night accent for links.
const STYLE = {
  width: '100%',
  border: 'none',
  colorScheme: 'light',
  '--gmp-mat-font-family': '"Be Vietnam Pro", system-ui, sans-serif',
  '--gmp-mat-color-surface': '#FFFFFF',
  '--gmp-mat-color-on-surface': '#2C2F30',
  '--gmp-mat-color-on-surface-variant': '#5E6464',
  '--gmp-mat-color-primary': '#A3214A',
  '--gmp-mat-color-outline-decorative': '#E9EDED',
}

export function PlaceDetailsCard({ placeId }) {
  const el = useRef(null)
  const [status, setStatus] = useState(hasMapsKey() && placeId ? 'loading' : 'hidden')

  useEffect(() => onAuthFailure(() => setStatus('hidden')), [])

  useEffect(() => {
    if (!hasMapsKey() || !placeId) return
    let cancelled = false
    loadGoogleMaps()
      .then(maps => maps.importLibrary('places'))
      .then(() => { if (!cancelled) setStatus('ready') })
      .catch(() => { if (!cancelled) setStatus('hidden') })
    return () => { cancelled = true }
  }, [placeId])

  // Google fires this when the place can't be shown (bad id, API not enabled,
  // over quota). Drop the card rather than show its error state.
  useEffect(() => {
    const node = el.current
    if (status !== 'ready' || !node) return
    const hide = () => setStatus('hidden')
    node.addEventListener('gmp-requesterror', hide)
    return () => node.removeEventListener('gmp-requesterror', hide)
  }, [status])

  if (status === 'hidden') return null

  return (
    <section aria-label="Google profile" className="overflow-hidden rounded-tile bg-surface shadow-soft">
      {status === 'ready' ? (
        <gmp-place-details ref={el} style={STYLE}>
          <gmp-place-details-place-request place={placeId} />
          <gmp-place-content-config>
            <gmp-place-media lightbox-preferred="" />
            <gmp-place-rating />
            <gmp-place-type />
            <gmp-place-price />
            <gmp-place-opening-hours />
            <gmp-place-website />
            <gmp-place-phone-number />
            <gmp-place-summary />
            <gmp-place-review-summary />
            <gmp-place-reviews />
            <gmp-place-attribution />
          </gmp-place-content-config>
        </gmp-place-details>
      ) : (
        <div aria-hidden="true" className="h-40 animate-pulse bg-track" />
      )}
    </section>
  )
}
