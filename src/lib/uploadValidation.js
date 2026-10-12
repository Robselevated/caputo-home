const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

const TYPE_MESSAGE = 'Only JPEG, PNG, and WebP images are allowed.'

// A file picked straight from the device, uploaded as is (the dish photo).
export function validateImageFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) return TYPE_MESSAGE
  if (file.size > MAX_SIZE_BYTES) return 'Image must be under 5MB.'
  return null
}

// A blob we produced ourselves (a compressed scan tile): checked after
// compression, so the size limit is the one the request can carry.
export function validateImageBlob(blob, { maxBytes = MAX_SIZE_BYTES } = {}) {
  if (!blob || typeof blob.size !== 'number') return 'That photo could not be converted.'
  if (!ALLOWED_TYPES.includes(blob.type)) return TYPE_MESSAGE
  if (blob.size > maxBytes) return 'That photo is too large to send, even compressed. Take a screenshot of it instead.'
  return null
}
