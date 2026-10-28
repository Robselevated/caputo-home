import { authFetch } from '../../lib/authFetch'

const ENDPOINT = '/.netlify/functions/places'

// One search session = autocompletes + one details call with the same token,
// which Google bills as a single details lookup.
export const newSessionToken = () => crypto.randomUUID()

async function post(body, signal) {
  const res = await authFetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  let data = null
  try { data = await res.json() } catch { /* empty body */ }
  if (!res.ok) throw new Error(data?.error || "Couldn't search right now")
  return data
}

export async function searchPlaces(input, { coords, sessionToken, signal } = {}) {
  const data = await post({ action: 'autocomplete', input, sessionToken, lat: coords?.lat, lng: coords?.lng }, signal)
  return data?.results ?? []
}

export async function getPlace(placeId, { sessionToken } = {}) {
  const data = await post({ action: 'details', placeId, sessionToken })
  return data?.place
}

// The saved Google link, or a Maps search pinned to the place id.
export function mapsLink(restaurant) {
  if (restaurant?.maps_url) return restaurant.maps_url
  const q = encodeURIComponent(restaurant?.name ?? '')
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(restaurant?.place_id ?? '')}`
}

// Coordinates for search bias, or null. Never throws; a denied or slow
// permission just searches without a location.
export function currentCoords({ timeoutMs = 5000 } = {}) {
  return new Promise((resolve) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : null
    if (!geo) { resolve(null); return }
    geo.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false }
    )
  })
}
