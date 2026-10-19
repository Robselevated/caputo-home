import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../../lib/authFetch', () => ({ authFetch: vi.fn() }))

import { authFetch } from '../../lib/authFetch'
import { planTiles, scanPhotos, MAX_TILES, MAX_TOTAL_BYTES } from './recipeScan'

const file = (name) => new File(['x'], name, { type: 'image/png' })
const tile = (label, bytes = 1000) => ({ base64: `b64-${label}`, media_type: 'image/jpeg', bytes })
const okResponse = (body) => ({ ok: true, status: 200, json: async () => body })
const badResponse = (status, body = {}) => ({ ok: false, status, json: async () => body })
const sentBody = () => JSON.parse(authFetch.mock.calls[0][1].body)

// One tile per file unless the name says otherwise ("tall" gives two).
const simplePrepare = vi.fn(async (f, opts = {}) => {
  const n = f.name.startsWith('tall') ? 2 : 1
  return { width: 1170, height: 2532, tiles: Array.from({ length: n }, (_, i) => tile(`${f.name}-${i}`, opts.bytes)) }
})

describe('planTiles', () => {
  it('keeps a phone screenshot as one tile at its own width', () => {
    expect(planTiles({ width: 1170, height: 2532 })).toEqual([{ sx: 0, sy: 0, sw: 1170, sh: 2532, dw: 1170, dh: 2532 }])
  })

  it('splits a stitched tall screenshot into overlapping bands no taller than 1600', () => {
    const tiles = planTiles({ width: 1170, height: 4500 })
    expect(tiles).toHaveLength(3)
    expect(tiles[0].sy).toBe(0)
    const last = tiles[tiles.length - 1]
    expect(last.sy + last.sh).toBe(4500)
    for (let i = 1; i < tiles.length; i++) {
      const prevEnd = tiles[i - 1].sy + tiles[i - 1].sh
      expect(prevEnd - tiles[i].sy).toBeGreaterThanOrEqual(120)
    }
    for (const t of tiles) {
      expect(t.sw).toBe(1170)
      expect(t.dh).toBeLessThanOrEqual(1600)
      expect(Math.max(t.dw, t.dh)).toBeLessThanOrEqual(1568)
      expect(t.dw / t.dh).toBeCloseTo(t.sw / t.sh, 1)
    }
  })

  it('scales a wide photo down to 1568 across as one tile', () => {
    expect(planTiles({ width: 4000, height: 3000 })).toEqual([{ sx: 0, sy: 0, sw: 4000, sh: 3000, dw: 1568, dh: 1176 }])
  })
})

describe('scanPhotos', () => {
  beforeEach(() => {
    authFetch.mockReset()
    simplePrepare.mockClear()
    authFetch.mockResolvedValue(okResponse({ name: 'Soup', ingredients: [] }))
  })

  it('sends every tile in ONE request with only base64 and media_type', async () => {
    const files = [file('a.png'), file('b.png'), file('c.png')]
    const controller = new AbortController()
    const result = await scanPhotos(files, { prepare: simplePrepare, signal: controller.signal })
    expect(authFetch).toHaveBeenCalledTimes(1)
    const [url, init] = authFetch.mock.calls[0]
    expect(url).toBe('/.netlify/functions/parse-recipe-image')
    expect(init.method).toBe('POST')
    expect(init.signal).toBe(controller.signal)
    expect(sentBody()).toEqual({ images: ['a.png-0', 'b.png-0', 'c.png-0'].map(l => ({ base64: `b64-${l}`, media_type: 'image/jpeg' })) })
    expect(result).toEqual({ parsed: { name: 'Soup', ingredients: [] }, skipped: [], tileCount: 3 })
  })

  it('reports progress for preparing and reading', async () => {
    const onProgress = vi.fn()
    await scanPhotos([file('a.png'), file('b.png')], { prepare: simplePrepare, onProgress })
    expect(onProgress).toHaveBeenCalledWith({ stage: 'preparing', done: 0, total: 2 })
    expect(onProgress).toHaveBeenCalledWith({ stage: 'preparing', done: 1, total: 2 })
    expect(onProgress).toHaveBeenLastCalledWith({ stage: 'reading', done: 0, total: 2 })
  })

  it('skips a photo that cannot be prepared and still reads the rest', async () => {
    const prepare = vi.fn(async (f) => {
      if (f.name === 'bad.heic') throw new Error('That photo format is not supported. Take a screenshot of it instead.')
      return simplePrepare(f)
    })
    const result = await scanPhotos([file('bad.heic'), file('a.png')], { prepare })
    expect(sentBody().images).toHaveLength(1)
    expect(result.skipped).toEqual([{ name: 'bad.heic', reason: 'That photo format is not supported. Take a screenshot of it instead.' }])
  })

  it('rejects with the reason when no photo could be prepared, without a request', async () => {
    const prepare = vi.fn(async () => { throw new Error('That photo format is not supported. Take a screenshot of it instead.') })
    await expect(scanPhotos([file('bad.heic')], { prepare })).rejects.toThrow(/not supported/)
    expect(authFetch).not.toHaveBeenCalled()
  })

  it('caps the batch at six tiles and names the photos that fell off', async () => {
    expect(MAX_TILES).toBe(6)
    const files = [file('tall-1.png'), file('tall-2.png'), file('tall-3.png'), file('d.png')]
    const result = await scanPhotos(files, { prepare: simplePrepare })
    expect(sentBody().images).toHaveLength(6)
    expect(result.tileCount).toBe(6)
    expect(result.skipped).toEqual([{ name: 'd.png', reason: 'over the 6-photo limit' }])
  })

  it('re-encodes at a lower quality when the batch is too heavy, then drops tiles from the end', async () => {
    const heavy = vi.fn(async (f, opts = {}) => ({ width: 1, height: 1, tiles: [tile(f.name, opts.quality === 0.7 ? 1.5 * 1024 * 1024 : 2.5 * 1024 * 1024)] }))
    const result = await scanPhotos([file('a.png'), file('b.png'), file('c.png')], { prepare: heavy })
    expect(heavy.mock.calls.filter(([, o]) => o?.quality === 0.7).map(([f]) => f.name)).toEqual(['a.png', 'b.png', 'c.png'])
    expect(sentBody().images).toHaveLength(2)
    expect(result.skipped).toEqual([{ name: 'c.png', reason: 'over the size limit for one scan' }])
    expect(MAX_TOTAL_BYTES).toBe(4 * 1024 * 1024)
  })

  it('propagates a cancel from the caller as an AbortError', async () => {
    const controller = new AbortController()
    authFetch.mockImplementation(async (url, { signal }) => {
      controller.abort()
      const e = new Error('aborted'); e.name = 'AbortError'; throw e
    })
    await expect(scanPhotos([file('a.png')], { prepare: simplePrepare, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('stops before the request when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(scanPhotos([file('a.png')], { prepare: simplePrepare, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(authFetch).not.toHaveBeenCalled()
  })

  it('turns a 413 into the too-big message and passes other server errors through', async () => {
    authFetch.mockResolvedValue(badResponse(413))
    await expect(scanPhotos([file('a.png')], { prepare: simplePrepare })).rejects.toThrow('Those photos are too big. Try fewer at once.')
    authFetch.mockResolvedValue(badResponse(422, { error: 'We could not read a recipe in those photos.' }))
    await expect(scanPhotos([file('a.png')], { prepare: simplePrepare })).rejects.toThrow('We could not read a recipe in those photos.')
  })

  it('reads a bare gateway 504 as too slow, but keeps our own 504 message', async () => {
    authFetch.mockResolvedValue(badResponse(504))
    await expect(scanPhotos([file('a.png')], { prepare: simplePrepare })).rejects.toThrow('Reading those photos took too long. Try again, or send fewer at once.')
    authFetch.mockResolvedValue(badResponse(504, { error: 'Reading those photos took too long. Try again with fewer at once.' }))
    await expect(scanPhotos([file('a.png')], { prepare: simplePrepare })).rejects.toThrow('Reading those photos took too long. Try again with fewer at once.')
  })
})
