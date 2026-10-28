// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./auth.js', () => ({ verifyAuth: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('./rate-limit.js', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5 })) }))

import { autocomplete, details, MAX_INPUT } from './places.js'
import { handler } from '../places.js'
import { verifyAuth } from './auth.js'
import { checkRateLimit } from './rate-limit.js'

const TOKEN = 'abcdef1234567890'
const PLACE = 'ChIJN1t_tDeuEmsRUsoyG83frY4'
const ok = (data) => ({ ok: true, status: 200, json: async () => data })
const post = (body) => ({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GOOGLE_PLACES_API_KEY = 'test-key'
})

describe('autocomplete', () => {
  it('maps predictions and sends a location bias when coordinates are given', async () => {
    const fetchImpl = vi.fn(async () => ok({
      suggestions: [
        { placePrediction: { placeId: PLACE, text: { text: 'Wild Sage, Spokane' }, structuredFormat: { mainText: { text: 'Wild Sage' }, secondaryText: { text: 'W 2nd Ave, Spokane, WA' } } } },
        { queryPrediction: { text: { text: 'wild sage near me' } } },
      ],
    }))
    const res = await autocomplete({ input: ' wild sage ', lat: 47.65, lng: -117.42, sessionToken: TOKEN }, { key: 'k', fetchImpl })
    expect(res).toEqual({ status: 200, body: { results: [{ placeId: PLACE, name: 'Wild Sage', secondary: 'W 2nd Ave, Spokane, WA' }] } })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toMatch(/places:autocomplete$/)
    expect(init.headers['X-Goog-Api-Key']).toBe('k')
    const sent = JSON.parse(init.body)
    expect(sent.input).toBe('wild sage')
    expect(sent.sessionToken).toBe(TOKEN)
    expect(sent.locationBias.circle.center).toEqual({ latitude: 47.65, longitude: -117.42 })
  })

  it('leaves out the bias without valid coordinates', async () => {
    const fetchImpl = vi.fn(async () => ok({}))
    await autocomplete({ input: 'tacos', lat: 'x', sessionToken: TOKEN }, { key: 'k', fetchImpl })
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).locationBias).toBeUndefined()
  })

  it('rejects short, long, or tokenless input without calling Google', async () => {
    const fetchImpl = vi.fn()
    expect((await autocomplete({ input: 'a', sessionToken: TOKEN }, { key: 'k', fetchImpl })).status).toBe(400)
    expect((await autocomplete({ input: 'a'.repeat(MAX_INPUT + 1), sessionToken: TOKEN }, { key: 'k', fetchImpl })).status).toBe(400)
    expect((await autocomplete({ input: 'tacos', sessionToken: 'bad token!' }, { key: 'k', fetchImpl })).status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('turns a Google quota stop into a friendly 429', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }))
    const res = await autocomplete({ input: 'tacos', sessionToken: TOKEN }, { key: 'k', fetchImpl })
    expect(res.status).toBe(429)
  })

  it('reports a timeout as 504', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('aborted') })
    expect((await autocomplete({ input: 'tacos', sessionToken: TOKEN }, { key: 'k', fetchImpl })).status).toBe(504)
  })
})

describe('details', () => {
  it('asks only for the fields we store and closes the session', async () => {
    const fetchImpl = vi.fn(async () => ok({
      id: PLACE,
      displayName: { text: 'Wild Sage' },
      primaryTypeDisplayName: { text: 'American Restaurant' },
      formattedAddress: '916 W 2nd Ave, Spokane, WA',
      googleMapsUri: 'https://maps.google.com/?cid=1',
      location: { latitude: 47.6573, longitude: -117.4235 },
    }))
    const res = await details({ placeId: PLACE, sessionToken: TOKEN }, { key: 'k', fetchImpl })
    expect(res.body.place).toEqual({
      placeId: PLACE, name: 'Wild Sage', cuisine: 'American Restaurant',
      address: '916 W 2nd Ave, Spokane, WA', mapsUrl: 'https://maps.google.com/?cid=1',
      lat: 47.6573, lng: -117.4235,
    })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`https://places.googleapis.com/v1/places/${PLACE}?sessionToken=${TOKEN}`)
    expect(init.headers['X-Goog-FieldMask']).toBe('id,displayName,primaryTypeDisplayName,formattedAddress,googleMapsUri,location')
  })

  it('rejects a place id that could change the URL path', async () => {
    const fetchImpl = vi.fn()
    expect((await details({ placeId: '../places:x', sessionToken: TOKEN }, { key: 'k', fetchImpl })).status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('handler', () => {
  it('needs the key, a login, and a known action', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY
    expect((await handler(post({ action: 'autocomplete' }))).statusCode).toBe(500)
    process.env.GOOGLE_PLACES_API_KEY = 'k'
    verifyAuth.mockResolvedValueOnce(null)
    expect((await handler(post({ action: 'autocomplete' }))).statusCode).toBe(401)
    expect((await handler(post({ action: 'nope' }))).statusCode).toBe(400)
    expect(checkRateLimit).not.toHaveBeenCalled()
  })

  it('stops at the rate limit', async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: false })
    expect((await handler(post({ action: 'autocomplete', input: 'tacos', sessionToken: TOKEN }))).statusCode).toBe(429)
  })
})
