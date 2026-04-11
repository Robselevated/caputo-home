const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export function validateImageFile(file) {
  // iOS HEIC/HEIF: detect by extension if browser reports empty type
  const ext = file.name?.split('.').pop()?.toLowerCase()
  if (ext === 'heic' || ext === 'heif' || file.type === 'image/heic' || file.type === 'image/heif') {
    return 'HEIC photos are not supported. On your iPhone, go to Settings > Camera > Formats and select "Most Compatible" to shoot in JPEG, then retake or re-export the photo.'
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, and WebP images are allowed.'
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'Image must be under 5MB.'
  }
  return null
}
