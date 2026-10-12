import { createDeadline } from './budget.js'
import { callModel, extractJson } from './anthropicClient.js'
import { RECIPE_IMAGE_PROMPT } from './prompts.js'
import { normalizeContract, reply, errorStatus, NO_INGREDIENTS, TOO_LONG } from './contract.js'

// Photos and screenshots -> recipe. Every page goes to the model in ONE call
// so overlapping screenshots merge into one recipe; the client has already
// resized and tiled them, so the server only checks shape and count.
export const MAX_IMAGES = 6
export const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const TOO_MANY_PHOTOS = `Send at most ${MAX_IMAGES} photos at a time.`
export const NO_RECIPE_IN_PHOTOS = 'We could not read a recipe in those photos.'
export const BAD_MEDIA_TYPE = 'Only JPEG, PNG, WebP and GIF photos can be read.'
export const NO_PHOTOS = 'Send at least one photo.'
export const PHOTOS_TOO_SLOW = 'Reading those photos took too long. Try again with fewer at once.'
export const PHOTOS_UNREADABLE = 'We could not read those photos. Try again.'

const READ_INSTRUCTION = 'Read the recipe in these images.'

const isHttpUrl = (v) => { try { return /^https?:$/.test(new URL(String(v)).protocol) } catch { return false } }

// The handler accepts the current `{ images }` shape plus three older ones.
export function imagesFromBody(body = {}) {
  const { images, image_base64, media_type, image_url, image_urls } = body || {}
  if (Array.isArray(images) && images.length) return images
  if (typeof image_base64 === 'string' && image_base64) return [{ base64: image_base64, media_type }]
  if (Array.isArray(image_urls) && image_urls.length) return image_urls.map(url => ({ type: 'url', url }))
  if (typeof image_url === 'string' && image_url) return [{ type: 'url', url: image_url }]
  return []
}

// Request items -> Anthropic image blocks, or a { status, body } refusal.
function toImageBlocks(images) {
  if (!Array.isArray(images) || images.length === 0) return reply(400, { error: NO_PHOTOS })
  if (images.length > MAX_IMAGES) return reply(422, { error: TOO_MANY_PHOTOS })
  const blocks = []
  for (const item of images) {
    if (item?.type === 'url' || (item?.url && !item?.base64)) {
      if (!isHttpUrl(item.url)) return reply(400, { error: 'One of the photo links does not look right.' })
      blocks.push({ type: 'image', source: { type: 'url', url: String(item.url) } })
      continue
    }
    const data = typeof item?.base64 === 'string' ? item.base64 : ''
    if (!data) return reply(400, { error: NO_PHOTOS })
    const mediaType = item.media_type || 'image/jpeg'
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) return reply(400, { error: BAD_MEDIA_TYPE })
    blocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } })
  }
  return { blocks }
}

export async function parseRecipeFromImages(images, { client = null, deadline = createDeadline() } = {}) {
  const prepared = toImageBlocks(images)
  if (prepared.status) return prepared

  try {
    if (!client) throw new Error('no model client')
    const content = [...prepared.blocks, { type: 'text', text: READ_INSTRUCTION }]
    const { text, stop_reason } = await callModel(client, { system: RECIPE_IMAGE_PROMPT, messages: [{ role: 'user', content }], max_tokens: 6000 }, deadline)
    // A reply the model could not finish is never patched into a 200.
    if (stop_reason === 'max_tokens') return reply(422, { error: TOO_LONG })
    const raw = extractJson(text)
    if (!raw) return reply(422, { error: NO_RECIPE_IN_PHOTOS })
    const recipe = normalizeContract(raw, { via: 'image' })
    if (!recipe.name && recipe.ingredients.length === 0) return reply(422, { error: NO_RECIPE_IN_PHOTOS })
    if (recipe.ingredients.length === 0) return reply(422, { error: NO_INGREDIENTS })
    return reply(200, recipe)
  } catch (err) {
    const known = errorStatus(err)
    if (known?.status === 504) return reply(504, { error: PHOTOS_TOO_SLOW })
    if (known) return known
    console.error('parse-recipe-image:', String(err?.message || err).split('\n')[0])
    return reply(502, { error: PHOTOS_UNREADABLE })
  }
}
