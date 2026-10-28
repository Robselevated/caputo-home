import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// CARTO Voyager: free OpenStreetMap-based tiles styled close to Google Maps
// (soft land, white roads, colored highways). {r} serves sharp tiles on
// retina phones. Both attributions are required by their terms.
const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

// A Google-style teardrop pin with a white dot, drawn inline because
// Leaflet's default marker images don't survive bundling.
const pin = (color) => L.divIcon({
  className: '',
  html: `<svg width="28" height="40" viewBox="0 0 28 40" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 40 14 40s14-15.7 14-26.1C28 6.2 21.7 0 14 0z" fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="1"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -36],
})

// `isolate` keeps Leaflet's own z-indexes (up to 1000) under the tab bar and sheets.
// Pins for the places in view. Tapping a pin shows its name; tapping the
// name opens the restaurant. Fits all pins on every change of the list.
export function RestaurantMap({ restaurants, color, onOpen }) {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false })
    L.tileLayer(TILES, { maxZoom: 20, subdomains: 'abcd', attribution: ATTRIBUTION }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    return () => { map.current.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    layer.current.clearLayers()
    const placed = restaurants.filter(r => r.lat != null && r.lng != null)
    for (const r of placed) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = r.name
      button.style.cssText = 'font:600 14px/1.3 inherit;color:inherit;background:none;border:0;padding:0;text-align:left'
      button.addEventListener('click', () => onOpenRef.current(r))
      L.marker([r.lat, r.lng], { icon: pin(color), title: r.name, alt: r.name }).bindPopup(button).addTo(layer.current)
    }
    if (placed.length === 1) m.setView([placed[0].lat, placed[0].lng], 14)
    else if (placed.length > 1) m.fitBounds(L.latLngBounds(placed.map(r => [r.lat, r.lng])), { padding: [28, 28], maxZoom: 15 })
  }, [restaurants, color])

  return <div ref={el} role="region" aria-label="Map of restaurants" className="isolate h-56 w-full overflow-hidden rounded-tile bg-track" />
}
