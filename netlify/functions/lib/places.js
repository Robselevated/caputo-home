// Google Places API (New) for the Date Night search. The key stays here on
// the server. A search session is many autocomplete calls ended by one
// details call with the same session token, which Google bills as just the
// details call. Daily quotas on the Google Cloud project are the hard cap.

const BASE = 'https://places.googleapis.com/v1'
const DETAILS_FIELDS = 'id,displayName,primaryTypeDisplayName,formattedAddress,googleMapsUri'
const BIAS_RADIUS_M = 50000 // Google's maximum for a bias circle
const TIMEOUT_MS = 8000

export const MAX_INPUT = 120
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/
const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,300}$/

const fail = (status, error) => ({ status, body: { error } })
const isCoord = (n, max) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= max

async function call(fetchImpl, url, init) {
  let res
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    return { error: fail(504, 'Google search timed out. Try again.') }
  }
  if (res.status === 429) return { error: fail(429, 'Search limit reached for today. Try again tomorrow.') }
  if (!res.ok) {
    console.warn('places: google returned', res.status)
    return { error: fail(502, "Couldn't reach Google search") }
  }
  return { data: await res.json() }
}

export async function autocomplete({ input, lat, lng, sessionToken }, { key, fetchImpl = fetch }) {
  const q = typeof input === 'string' ? input.trim() : ''
  if (q.length < 2 || q.length > MAX_INPUT) return fail(400, 'Type at least two letters')
  if (!TOKEN_RE.test(sessionToken ?? '')) return fail(400, 'Bad request')

  const body = { input: q, sessionToken }
  if (isCoord(lat, 90) && isCoord(lng, 180)) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: BIAS_RADIUS_M } }
  }

  const { data, error } = await call(fetchImpl, `${BASE}/places:autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
    body: JSON.stringify(body),
  })
  if (error) return error

  const results = (data?.suggestions ?? [])
    .map(s => s.placePrediction)
    .filter(p => p?.placeId)
    .map(p => ({
      placeId: p.placeId,
      name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secondary: p.structuredFormat?.secondaryText?.text ?? '',
    }))
  return { status: 200, body: { results } }
}

export async function details({ placeId, sessionToken }, { key, fetchImpl = fetch }) {
  if (!PLACE_ID_RE.test(placeId ?? '')) return fail(400, 'Bad request')
  const qs = TOKEN_RE.test(sessionToken ?? '') ? `?sessionToken=${sessionToken}` : ''

  const { data, error } = await call(fetchImpl, `${BASE}/places/${placeId}${qs}`, {
    method: 'GET',
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': DETAILS_FIELDS },
  })
  if (error) return error

  return {
    status: 200,
    body: {
      place: {
        placeId: data?.id ?? placeId,
        name: data?.displayName?.text ?? '',
        cuisine: data?.primaryTypeDisplayName?.text ?? null,
        address: data?.formattedAddress ?? null,
        mapsUrl: data?.googleMapsUri ?? null,
      },
    },
  }
}
