import Anthropic from '@anthropic-ai/sdk'
import { verifyAuth } from './lib/auth.js'
import { checkRateLimit } from './lib/rate-limit.js'

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const user = await verifyAuth(event)
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

  const { allowed } = await checkRateLimit(user.id, 'expand-suggestion', 15)
  if (!allowed) return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }) }

  try {
    const { name, description, matched_ingredients, missing_ingredients, tags } = JSON.parse(event.body)

    if (!name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing recipe name' }) }
    }

    const allIngredients = [
      ...(matched_ingredients || []),
      ...(missing_ingredients || []),
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a home cooking assistant generating a complete recipe. Create a detailed, practical recipe for "${name}".

${description ? `Description: ${description}` : ''}

The cook has these ingredients on hand: ${(matched_ingredients || []).join(', ') || 'unknown'}
They may also need: ${(missing_ingredients || []).join(', ') || 'nothing extra'}
${tags && tags.length > 0 ? `Tags/style: ${tags.join(', ')}` : ''}

Return a JSON object with:
- "name": "${name}"
- "description": brief 1-2 sentence description (string)
- "servings": number of servings (integer)
- "prep_time": prep time in minutes (integer)
- "cook_time": cook time in minutes (integer)
- "tags": ${JSON.stringify(tags || [])}
- "instructions": full step-by-step instructions as text with numbered steps (string)
- "ingredients": array of ingredient objects, each with:
  - "section": ingredient group heading (string or null). Use sections when ingredients naturally group (e.g., "Sauce", "Chicken", "For the marinade"). Use null when no grouping needed.
  - "name": ingredient name (string)
  - "qty": numeric quantity as a decimal number (number)
  - "unit": measurement unit: cup, tbsp, tsp, oz, lb, gram, kg, count, slices, can, package, pinch, dash, bunch, clove, sprig (string)
  - "notes": prep notes like "chopped", "melted" (string or null)

Guidelines:
- Use practical, home-cook-friendly quantities
- Include ALL ingredients needed (both the ones on hand and any missing ones)
- Keep instructions clear and numbered
- Target a practical everyday meal, not restaurant-level
- Return ONLY a valid JSON object. No markdown, no explanation.`,
        },
      ],
    })

    const text = response.content[0].text
    const jsonMatch = text.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to generate recipe details' }),
      }
    }

    const recipe = JSON.parse(jsonMatch[0])

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    }
  } catch (err) {
    console.error('Expand suggestion error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate recipe details' }),
    }
  }
}
