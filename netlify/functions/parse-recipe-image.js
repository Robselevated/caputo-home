import Anthropic from '@anthropic-ai/sdk'
import { verifyAuth } from './lib/auth.js'
import { checkRateLimit } from './lib/rate-limit.js'

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })

const RECIPE_OCR_PROMPT = `You are analyzing a photo of a recipe. This could be a cookbook page, handwritten recipe card, printed recipe, or screenshot.

Extract as much structured recipe information as you can. Return a JSON object with these keys:

- "name": recipe title (string, required, best guess if unclear)
- "description": brief 1-2 sentence description (string or null)
- "servings": number of servings (integer or null)
- "prep_time": prep time in minutes (integer or null)
- "cook_time": cook time in minutes (integer or null)
- "tags": array of relevant tags like cuisine type, meal type, dietary (string array, can be empty)
- "instructions": full step-by-step instructions as text with numbered steps (string or null)
- "ingredients": array of ingredient objects, each with:
  - "section": ingredient group heading like "Chicken", "Sauce", "Green Sauce", "For the marinade" (string or null). Many recipes group ingredients under sub-headings. When ingredients are grouped this way, set the section field to the group name. When there are no sub-groups, set to null.
  - "name": ingredient name (string)
  - "qty": numeric quantity as a decimal number (e.g. 0.5 not "1/2") (number or null)
  - "unit": measurement unit standardized to one of: cup, tbsp, tsp, oz, lb, gram, kg, count, slices, can, package, pinch, dash, bunch, clove, sprig (string or null)
  - "notes": any prep notes like "chopped", "melted", "room temperature" (string or null)

Important:
- Convert all fractions to decimals (1/2 = 0.5, 1/3 = 0.333, 1/4 = 0.25, 3/4 = 0.75)
- If text is partially illegible, extract what you can and mark unclear parts with [unclear] in the notes
- If you cannot determine a field, set it to null
- Preserve the order of ingredient sections as they appear in the original recipe
- Return ONLY a valid JSON object. No markdown, no explanation.`

const MULTI_IMAGE_PROMPT = `You are analyzing multiple screenshots of the same recipe page. The screenshots show different parts of the recipe (title, ingredients, instructions, etc.) and may overlap. Combine all visible information into one complete recipe.

Extract as much structured recipe information as you can. Return a JSON object with these keys:

- "name": recipe title (string, required, best guess if unclear)
- "description": brief 1-2 sentence description (string or null)
- "servings": number of servings (integer or null)
- "prep_time": prep time in minutes (integer or null)
- "cook_time": cook time in minutes (integer or null)
- "tags": array of relevant tags like cuisine type, meal type, dietary (string array, can be empty)
- "instructions": full step-by-step instructions as text with numbered steps (string or null)
- "ingredients": array of ingredient objects, each with:
  - "section": ingredient group heading like "Chicken", "Sauce", "Green Sauce", "For the marinade" (string or null). Many recipes group ingredients under sub-headings. When ingredients are grouped this way, set the section field to the group name. When there are no sub-groups, set to null.
  - "name": ingredient name (string)
  - "qty": numeric quantity as a decimal number (e.g. 0.5 not "1/2") (number or null)
  - "unit": measurement unit standardized to one of: cup, tbsp, tsp, oz, lb, gram, kg, count, slices, can, package, pinch, dash, bunch, clove, sprig (string or null)
  - "notes": any prep notes like "chopped", "melted", "room temperature" (string or null)

Important:
- Convert all fractions to decimals (1/2 = 0.5, 1/3 = 0.333, 1/4 = 0.25, 3/4 = 0.75)
- Do NOT duplicate ingredients that appear in multiple screenshots
- Preserve the order of ingredient sections as they appear in the original recipe
- Return ONLY a valid JSON object. No markdown, no explanation.`

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  if (!process.env.CLAUDE_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error', details: 'CLAUDE_API_KEY env var is not set in Netlify' }),
    }
  }

  const user = await verifyAuth(event)
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

  // Bumped from 15 → 60 because the client now fans out one call per image
  // (typical scan: 3-7 images = 3-7 invocations). 60/hr = ~10 multi-image scans.
  const { allowed } = await checkRateLimit(user.id, 'parse-recipe-image', 60)
  if (!allowed) return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }) }

  try {
    const { image_base64, media_type, image_url, images, image_urls } = JSON.parse(event.body)

    const isMultiUrl = Array.isArray(image_urls) && image_urls.length > 0
    const isMultiB64 = Array.isArray(images) && images.length > 0
    const isMulti = isMultiUrl || isMultiB64
    if (!isMulti && !image_base64 && !image_url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing image_base64, image_url, image_urls, or images' }) }
    }

    let contentBlocks

    if (isMultiUrl) {
      // Multi-image via public URLs (preferred — keeps request body tiny)
      contentBlocks = image_urls.map((url) => ({
        type: 'image',
        source: { type: 'url', url },
      }))
      contentBlocks.push({ type: 'text', text: MULTI_IMAGE_PROMPT })
    } else if (isMultiB64) {
      // Multi-image via base64 (legacy path; still supported)
      contentBlocks = images.map((img) => ({
        type: 'image',
        source: { type: 'base64', media_type: img.media_type || 'image/jpeg', data: img.base64 },
      }))
      contentBlocks.push({ type: 'text', text: MULTI_IMAGE_PROMPT })
    } else {
      // Single image (backward compatible)
      const imageSource = image_base64
        ? { type: 'base64', media_type: media_type || 'image/jpeg', data: image_base64 }
        : { type: 'url', url: image_url }
      contentBlocks = [
        { type: 'image', source: imageSource },
        { type: 'text', text: RECIPE_OCR_PROMPT },
      ]
    }

    const imageCount = isMultiUrl ? image_urls.length : isMultiB64 ? images.length : 1
    const response = await anthropic.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: imageCount > 1 ? 8192 : 4096,
        messages: [
          {
            role: 'user',
            content: contentBlocks,
          },
        ],
      },
      { timeout: 22000 }
    )

    const text = response.content[0].text
    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          description: null,
          servings: null,
          prep_time: null,
          cook_time: null,
          tags: [],
          instructions: null,
          ingredients: [],
          _partial: true,
        }),
      }
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    }
  } catch (err) {
    console.error('Recipe OCR error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Recipe image parsing failed',
        details: err?.message || String(err),
      }),
    }
  }
}
