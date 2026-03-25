import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })

const RECIPE_PROMPT = `You are parsing a recipe from HTML content. Extract the following information:

- name: Recipe title
- description: Brief description (1-2 sentences)
- servings: Number of servings (integer)
- prep_time: Prep time in minutes (integer, estimate if range given)
- cook_time: Cook time in minutes (integer, estimate if range given)
- tags: Array of relevant tags (cuisine type, meal type, dietary restrictions, etc.)
- instructions: Complete cooking instructions as a single text block
- image_url: Main recipe image URL (full URL, not relative path)
- ingredients: Array of objects with structure: { "name": "ingredient name", "qty": number, "unit": "measurement unit", "notes": "optional notes like 'chopped' or 'divided'" }

For ingredients:
- Extract the quantity as a number (convert fractions to decimals: 1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75)
- Use standard units: cup, tbsp, tsp, oz, lb, gram, kg, count, can, package
- If no quantity is specified, use qty: 1 and unit: "to taste"
- Put preparation notes (chopped, diced, etc.) in the notes field

Return ONLY a valid JSON object with this exact structure. No markdown, no explanation.`

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { url } = JSON.parse(event.body)

    if (!url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing url parameter' }) }
    }

    // Fetch HTML content from the URL
    const htmlResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeParser/1.0)',
      },
    })

    if (!htmlResponse.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Failed to fetch URL: ${htmlResponse.statusText}` }),
      }
    }

    const html = await htmlResponse.text()

    // Call Claude API to parse the recipe
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${RECIPE_PROMPT}\n\nHTML Content:\n${html.slice(0, 50000)}`,
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
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to parse recipe from response' }),
      }
    }

    const recipe = JSON.parse(jsonMatch[0])

    // Validate required fields
    if (!recipe.name || !recipe.ingredients || !Array.isArray(recipe.ingredients)) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Invalid recipe data structure' }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    }
  } catch (err) {
    console.error('Recipe parsing error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Recipe parsing failed', details: err.message }),
    }
  }
}
