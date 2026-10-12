import { supabase } from '../../lib/supabase'
import { authFetch } from '../../lib/authFetch'
import { validateImageBlob } from '../../lib/uploadValidation'

const BUCKET = 'recipe-images'

// Limits for one scan request. Netlify takes 6MB per request; base64 adds a
// third, so 4MB of JPEG is the ceiling. Six tiles matches the server cap.
export const MAX_TILES = 6
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024
export const MAX_TILE_BYTES = 700 * 1024
const HARD_TILE_BYTES = 2 * MAX_TILE_BYTES

export const UNSUPPORTED_FORMAT = 'That photo format is not supported. Take a screenshot of it instead.'
export const TOO_BIG = 'Those photos are too big. Try fewer at once.'
export const OVER_TILE_LIMIT = `over the ${MAX_TILES}-photo limit`
export const OVER_SIZE_LIMIT = 'over the size limit for one scan'

// Where to cut an image so the model gets readable text. The API shrinks
// anything with a long edge past 1568, which turns a stitched tall screenshot
// into a 400px-wide strip; such images become overlapping bands instead. A
// single phone screenshot (about 2.17 times as tall as wide) stays whole.
export function planTiles({ width, height }, { maxEdge = 1568, tileHeight = 1600, overlap = 120, maxRatio = 2.25 } = {}) {
  const scale = Math.min(1, maxEdge / width)
  const W = Math.round(width * scale)
  const H = Math.round(height * scale)
  if (H <= maxRatio * W) return [{ sx: 0, sy: 0, sw: width, sh: height, dw: W, dh: H }]

  const step = tileHeight - overlap
  const count = Math.max(1, Math.ceil((H - overlap) / step))
  const tiles = []
  for (let i = 0; i < count; i++) {
    const y = Math.max(0, Math.min(i * step, H - tileHeight))
    const h = Math.min(tileHeight, H - y)
    const bandScale = Math.min(1, maxEdge / Math.max(W, h))
    tiles.push({
      sx: 0,
      sy: Math.round(y / scale),
      sw: width,
      sh: Math.round(h / scale),
      dw: Math.round(W * bandScale),
      dh: Math.round(h * bandScale),
    })
  }
  return tiles
}

function decodeFailure() {
  return new Error(UNSUPPORTED_FORMAT)
}

// A drawable source plus its size. createImageBitmap honours EXIF rotation
// and decodes HEIC where the OS can (iOS 17+); the Image element is the
// fallback for older browsers.
async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() }
    } catch {
      throw decodeFailure()
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    const done = () => URL.revokeObjectURL(url)
    img.onload = () => {
      done()
      if (!img.naturalWidth || !img.naturalHeight) return reject(decodeFailure())
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} })
    }
    img.onerror = () => { done(); reject(decodeFailure()) }
    img.src = url
  })
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('That photo could not be converted.'))), 'image/jpeg', quality)
  })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => { const s = String(reader.result); resolve(s.slice(s.indexOf(',') + 1)) }
    reader.onerror = () => reject(new Error('That photo could not be converted.'))
    reader.readAsDataURL(blob)
  })
}

// One file -> JPEG tiles ready to send. Rejects with a per-photo message the
// caller can show; the batch goes on without this file.
export async function prepareImage(file, { quality = 0.8, retryQuality = 0.7, maxTileBytes = MAX_TILE_BYTES, ...geometry } = {}) {
  const decoded = await decodeImage(file)
  try {
    const plan = planTiles({ width: decoded.width, height: decoded.height }, geometry)
    const tiles = []
    for (const t of plan) {
      const canvas = document.createElement('canvas')
      canvas.width = t.dw
      canvas.height = t.dh
      canvas.getContext('2d').drawImage(decoded.source, t.sx, t.sy, t.sw, t.sh, 0, 0, t.dw, t.dh)
      let blob = await canvasToBlob(canvas, quality)
      if (blob.size > maxTileBytes && retryQuality < quality) blob = await canvasToBlob(canvas, retryQuality)
      const invalid = validateImageBlob(blob, { maxBytes: HARD_TILE_BYTES })
      if (invalid) throw new Error(invalid)
      tiles.push({ base64: await blobToBase64(blob), media_type: 'image/jpeg', bytes: blob.size })
    }
    return { tiles, width: decoded.width, height: decoded.height }
  } finally {
    decoded.close()
  }
}

function abortError() {
  const err = new Error('Cancelled')
  err.name = 'AbortError'
  return err
}

const sumBytes = (tiles) => tiles.reduce((n, t) => n + (t.bytes || 0), 0)

// Prepare every file (a bad one is skipped, not fatal), keep the batch inside
// the tile and byte limits, then read them all in ONE request so overlapping
// screenshots merge into one recipe on the server.
export async function scanPhotos(files, { signal, onProgress, prepare = prepareImage, maxTiles = MAX_TILES, maxTotalBytes = MAX_TOTAL_BYTES } = {}) {
  const list = Array.from(files || [])
  const skipped = []
  const progress = (p) => { try { onProgress?.(p) } catch { /* progress is cosmetic */ } }
  const checkAbort = () => { if (signal?.aborted) throw abortError() }

  const prepareAll = async (targets, opts) => {
    const out = []
    for (let i = 0; i < targets.length; i++) {
      checkAbort()
      progress({ stage: 'preparing', done: i, total: targets.length })
      const file = targets[i]
      try {
        const { tiles } = await prepare(file, opts)
        for (const t of tiles) out.push({ ...t, name: file.name })
      } catch (err) {
        if (err?.name === 'AbortError') throw err
        skipped.push({ name: file.name, reason: err?.message || UNSUPPORTED_FORMAT })
      }
    }
    return out
  }

  checkAbort()
  let tiles = await prepareAll(list, {})

  if (tiles.length > maxTiles) {
    const dropped = tiles.splice(maxTiles)
    for (const name of new Set(dropped.map(t => t.name))) skipped.push({ name, reason: OVER_TILE_LIMIT })
  }

  if (sumBytes(tiles) > maxTotalBytes) {
    const keptFiles = list.filter(f => tiles.some(t => t.name === f.name))
    const before = skipped.length
    const again = await prepareAll(keptFiles, { quality: 0.7 })
    skipped.splice(before)
    tiles = again.slice(0, maxTiles)
    while (tiles.length > 1 && sumBytes(tiles) > maxTotalBytes) {
      const last = tiles.pop()
      if (!skipped.some(s => s.name === last.name && s.reason === OVER_SIZE_LIMIT)) skipped.push({ name: last.name, reason: OVER_SIZE_LIMIT })
    }
  }

  if (tiles.length === 0) throw new Error(skipped[0]?.reason || 'Pick at least one photo.')
  checkAbort()
  progress({ stage: 'reading', done: 0, total: tiles.length })

  const response = await authFetch('/.netlify/functions/parse-recipe-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: tiles.map(({ base64, media_type }) => ({ base64, media_type })) }),
    signal,
  })
  if (!response.ok) {
    if (response.status === 413) throw new Error(TOO_BIG)
    const errBody = await response.json().catch(() => ({}))
    throw new Error(errBody.error || `Could not read those photos (HTTP ${response.status}).`)
  }
  const parsed = await response.json()
  return { parsed, skipped, tileCount: tiles.length }
}


// Photo of the finished dish, stored as is.
export async function uploadDishImage(file, householdId, prefix) {
  const ext = file.name.split('.').pop()
  const path = `${householdId}/${prefix}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw new Error(`Image upload failed: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data?.publicUrl
}
