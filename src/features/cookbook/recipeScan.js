import { supabase } from '../../lib/supabase'
import { authFetch } from '../../lib/authFetch'
import { validateImageFile } from '../../lib/uploadValidation'

const BUCKET = 'recipe-images'

export function compressImage(file, maxWidth = 1500, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Image compression timed out')), 15000)
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        clearTimeout(timeout)
        if (!blob) return reject(new Error('Image compression failed'))
        resolve(blob)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      clearTimeout(timeout)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

// Several pages of one recipe come back as several partial parses; merge
// them into one, preferring the longest name and instructions and deduping
// ingredients by section + name + amount.
export function mergeScannedRecipes(results) {
  const valid = results.filter(r => r && !r._partial)
  if (valid.length === 0) return results[0] || {}
  if (valid.length === 1) return valid[0]

  const pickFirst = (key) => valid.find(r => r[key] != null && r[key] !== '')?.[key] ?? null
  const pickLongest = (key) => {
    const vals = valid.map(r => r[key]).filter(v => typeof v === 'string' && v.length > 0)
    return vals.sort((a, b) => b.length - a.length)[0] ?? null
  }

  const seen = new Set()
  const ingredients = []
  for (const r of valid) {
    for (const ing of (r.ingredients || [])) {
      const key = `${(ing.section || '').toLowerCase().trim()}|${(ing.name || '').toLowerCase().trim()}|${ing.qty ?? ''}|${ing.unit || ''}`
      if (!seen.has(key)) {
        seen.add(key)
        ingredients.push(ing)
      }
    }
  }

  return {
    name: pickLongest('name'),
    description: pickFirst('description'),
    servings: pickFirst('servings'),
    prep_time: pickFirst('prep_time'),
    cook_time: pickFirst('cook_time'),
    tags: [...new Set(valid.flatMap(r => r.tags || []))],
    instructions: pickLongest('instructions'),
    ingredients,
  }
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      resolve({ base64: dataUrl.slice(dataUrl.indexOf(',') + 1), media_type: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function firstInvalid(files) {
  for (const file of files) {
    const err = validateImageFile(file)
    if (err) return err
  }
  return null
}

function publicUrlFor(path) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data?.publicUrl
}

export async function uploadDishImage(file, householdId, prefix) {
  const ext = file.name.split('.').pop()
  const path = `${householdId}/${prefix}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw new Error(`Image upload failed: ${error.message}`)
  return publicUrlFor(path)
}

async function parseImage(body, index) {
  const response = await authFetch('/.netlify/functions/parse-recipe-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}))
    const base = errBody.error || 'Scan failed'
    const detail = errBody.details ? `: ${errBody.details}` : ''
    const where = index == null ? '' : `Image ${index + 1}: `
    throw new Error(`${where}${base}${detail} (HTTP ${response.status})`)
  }
  return response.json()
}

// New-recipe flow. Photos are compressed and uploaded first and the function
// gets public URLs, because base64 for several screenshots blows past
// Netlify's 6MB request limit. One call per photo keeps each under the 10s
// sync timeout; the parses merge afterwards.
export async function scanPhotosViaStorage(files, householdId) {
  const invalid = firstInvalid(files)
  if (invalid) throw new Error(invalid)

  let urls
  try {
    urls = await Promise.all(files.map(async (file) => {
      const compressed = await compressImage(file)
      const path = `${householdId}/source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
      const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw new Error(`Storage upload failed: ${error.message}`)
      const url = publicUrlFor(path)
      if (!url) throw new Error('Storage upload returned no public URL')
      return url
    }))
  } catch (err) {
    throw new Error(`Could not upload images: ${err.message}`)
  }

  const settled = await Promise.allSettled(urls.map((url, i) => parseImage({ image_url: url }, i)))
  const ok = settled.filter(r => r.status === 'fulfilled').map(r => r.value)
  const failed = settled.filter(r => r.status === 'rejected').map(r => r.reason?.message || 'unknown error')
  if (ok.length === 0) throw new Error(failed[0] || 'All images failed to scan')

  return {
    parsed: mergeScannedRecipes(ok),
    sourceImageUrls: urls,
    warning: failed.length ? `Scanned ${ok.length} of ${urls.length} images. ${failed[0]}` : null,
  }
}

// Edit flow: the photos travel inline as base64 in one call and nothing is
// stored, since the recipe already has its source image (if any).
export async function scanPhotosInline(files) {
  const invalid = firstInvalid(files)
  if (invalid) throw new Error(invalid)
  const images = await Promise.all(files.map(fileToBase64))
  const parsed = await parseImage({ images })
  return { parsed, sourceImageUrls: [], warning: null }
}
