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

  const { allowed } = await checkRateLimit(user.id, 'suggest-recipes', 10)
  if (!allowed) return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }) }

  try {
    const { ingredients } = JSON.parse(event.body)

    if (!ingredients || ingredients.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No ingredients provided' }) }
    }

    const ingredientList = ingredients.map(i => i.name).join(', ')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a home cooking assistant. Given the ingredients a household currently has on hand, suggest 4-6 practical meal ideas they could make.

Available ingredients: ${ingredientList}

For each recipe suggestion, return a JSON object with:
- "name": recipe name (string)
- "description": 1-2 sentence description (string)
- "matched_ingredients": array of ingredient names from the available list that this recipe uses (string array)
- "missing_ingredients": array of common ingredients this recipe needs that are NOT in the available list (string array, keep short, only essentials)
- "difficulty": "easy", "medium", or "hard"
- "time_estimate": approximate total time in minutes (integer)
- "tags": array of relevant tags like cuisine type, meal type (string array, 2-3 max)

Guidelines:
- Prioritize recipes that use mostly available ingredients (aim for 70%+ match)
- Include a mix: some that need nothing extra, some that need 1-2 items
- Suggest practical, everyday meals, not restaurant-level dishes
- Consider ingredient combinations that make sense together
- Sort by best match first (most available ingredients used)

Return ONLY a valid JSON array. No markdown, no explanation.`,
        },
      ],
    })

    const text = response.content[0].text
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(suggestions),
    }
  } catch (err) {
    console.error('Suggestion error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate recipe suggestions' }),
    }
  }
}
