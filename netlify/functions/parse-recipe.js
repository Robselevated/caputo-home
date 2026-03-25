import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })

const RECIPE_PROMPT = `You are parsing a recipe from content. Extract the following information:

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

async function fetchContent(url) {
  // Try direct fetch first
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })
    if (resp.ok) {
      return await resp.text()
    }
  } catch (_) {
    // Direct fetch failed, try Firecrawl
  }

  // Fallback: use Firecrawl API to bypass anti-bot protection
  const firecrawlKey = process.env.FIRECRAWL_API_KEY
  if (!firecrawlKey) {
    throw new Error('Site blocked direct access and Firecrawl API key is not configured')
  }

  const fcResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${firecrawlKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
    }),
  })

  if (!fcResp.ok) {
    const errText = await fcResp.text()
    throw new Error(`Firecrawl failed: ${errText}`)
  }

  const fcData = await fcResp.json()
  return fcData.data?.markdown || fcData.data?.html || ''
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { url } = JSON.parse(event.body)

    if (!url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing url parameter' }) }
    }

    const content = await fetchContent(url)

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
              text: `${RECIPE_PROMPT}\n\nRecipe page content:\n${content.slice(0, 50000)}`,
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
