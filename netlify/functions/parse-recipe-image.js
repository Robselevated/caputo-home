import Anthropic from '@anthropic-ai/sdk'

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

  try {
    const { image_base64, media_type, image_url, images } = JSON.parse(event.body)

    const isMulti = Array.isArray(images) && images.length > 0
    if (!isMulti && !image_base64 && !image_url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing image_base64, image_url, or images array' }) }
    }

    let contentBlocks

    if (isMulti) {
      // Multiple screenshots of the same recipe
      contentBlocks = []
      for (const img of images) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: img.media_type || 'image/jpeg', data: img.base64 },
        })
      }
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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: isMulti ? 8192 : 4096,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    })

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
      body: JSON.stringify({ error: 'Recipe image parsing failed' }),
    }
  }
}
