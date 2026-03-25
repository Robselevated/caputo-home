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
  - "name": ingredient name (string)
  - "qty": numeric quantity as a decimal number (e.g. 0.5 not "1/2") (number or null)
  - "unit": measurement unit standardized to one of: cup, tbsp, tsp, oz, lb, gram, kg, count, slices, can, package, pinch, dash, bunch, clove, sprig (string or null)
  - "notes": any prep notes like "chopped", "melted", "room temperature" (string or null)

Important:
- Convert all fractions to decimals (1/2 = 0.5, 1/3 = 0.333, 1/4 = 0.25, 3/4 = 0.75)
- If text is partially illegible, extract what you can and mark unclear parts with [unclear] in the notes
- If you cannot determine a field, set it to null
- Return ONLY a valid JSON object. No markdown, no explanation.`

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { image_base64, media_type, image_url } = JSON.parse(event.body)

    if (!image_base64 && !image_url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing image_base64 or image_url' }) }
    }

    const imageSource = image_base64
      ? { type: 'base64', media_type: media_type || 'image/jpeg', data: image_base64 }
      : { type: 'url', url: image_url }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: imageSource,
            },
            {
              type: 'text',
              text: RECIPE_OCR_PROMPT,
            },
          ],
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
