import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Free OpenStreetMap tiles; attribution is required by their terms.
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

// A plain colored dot: Leaflet's default marker images don't survive bundling.
const pin = (color) => L.divIcon({
  className: '',
  html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
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
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map.current)
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
