import { useEffect, useRef, useState } from 'react'
import { MapPinOff } from 'lucide-react'
import { loadGoogleMaps, hasMapsKey, mapId, onAuthFailure } from './googleMaps'

// `isolate` keeps Google's own z-indexes under the tab bar and sheets.
const FRAME = 'isolate h-56 w-full overflow-hidden rounded-tile bg-track'

// Google's pin border is a darker shade of its fill.
function darken(hex, amount = 0.3) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift) => Math.round(((n >> shift) & 255) * (1 - amount))
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`
}

// Real Google map with pins for the places in view. Tapping a pin shows its
// name; tapping the name opens the restaurant. Fits all pins on every change
// of the list. Without a key, or if Google refuses it, shows a quiet tile.
export function RestaurantMap({ restaurants, color, onOpen }) {
  const el = useRef(null)
  const gmap = useRef(null) // { maps, map, InfoWindow, AdvancedMarkerElement, PinElement }
  const markers = useRef([])
  const infoWindow = useRef(null)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  const [status, setStatus] = useState(hasMapsKey() ? 'loading' : 'unavailable')

  useEffect(() => onAuthFailure(() => setStatus('unavailable')), [])

  useEffect(() => {
    if (!hasMapsKey()) return
    let cancelled = false
    ;(async () => {
      try {
        const maps = await loadGoogleMaps()
        const [{ Map, InfoWindow }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
          maps.importLibrary('maps'),
          maps.importLibrary('marker'),
        ])
        if (cancelled || !el.current) return
        const map = new Map(el.current, {
          mapId: mapId(),
          center: { lat: 0, lng: 0 },
          zoom: 2,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        })
        infoWindow.current = new InfoWindow({ headerDisabled: true })
        gmap.current = { maps, map, AdvancedMarkerElement, PinElement }
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('unavailable')
      }
    })()
    return () => {
      cancelled = true
      gmap.current = null
    }
  }, [])

  useEffect(() => {
    const g = gmap.current
    if (status !== 'ready' || !g) return
    const { maps, map, AdvancedMarkerElement, PinElement } = g

    infoWindow.current?.close()
    for (const m of markers.current) m.map = null
    markers.current = []

    const placed = restaurants.filter(r => r.lat != null && r.lng != null)
    for (const r of placed) {
      const pin = new PinElement({ background: color, borderColor: darken(color), glyphColor: '#fff' })
      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: r.lat, lng: r.lng },
        content: pin.element,
        title: r.name,
        gmpClickable: true,
      })
      marker.addListener('click', () => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = r.name
        button.style.cssText = 'font:600 14px/1.3 inherit;color:inherit;background:none;border:0;padding:0;text-align:left'
        button.addEventListener('click', () => onOpenRef.current(r))
        infoWindow.current.setContent(button)
        infoWindow.current.open({ anchor: marker, map })
      })
      markers.current.push(marker)
    }

    if (placed.length === 1) {
      map.setCenter({ lat: placed[0].lat, lng: placed[0].lng })
      map.setZoom(14)
    } else if (placed.length > 1) {
      const bounds = new maps.LatLngBounds()
      for (const r of placed) bounds.extend({ lat: r.lat, lng: r.lng })
      map.fitBounds(bounds, 28)
      // fitBounds has no zoom cap: pull back in if two close pins zoomed to street level.
      maps.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > 15) map.setZoom(15) })
    }
  }, [status, restaurants, color])

  if (status === 'unavailable') {
    return (
      <div role="region" aria-label="Map of restaurants" className={`${FRAME} flex flex-col items-center justify-center gap-2 text-ink-3`}>
        <MapPinOff size={28} strokeWidth={1.6} aria-hidden="true" />
        <p className="text-sm">Map unavailable</p>
      </div>
    )
  }
  return <div ref={el} role="region" aria-label="Map of restaurants" className={FRAME} />
}
