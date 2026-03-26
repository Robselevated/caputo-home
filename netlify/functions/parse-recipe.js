import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })

const RECIPE_PROMPT = `You are parsing a recipe from content. You will receive structured data (JSON-LD) and/or the recipe HTML from the page. Extract the following information:

- name: Recipe title
- description: Brief description (1-2 sentences)
- servings: Number of servings (integer)
- prep_time: Prep time in minutes (integer, estimate if range given)
- cook_time: Cook time in minutes (integer, estimate if range given)
- tags: Array of relevant tags (cuisine type, meal type, dietary restrictions, etc.)
- instructions: Complete cooking instructions as numbered steps, one step per line (e.g. "1. Do this\\n2. Do that\\n3. Then this")
- image_url: Main recipe image URL (full URL, not relative path)
- ingredients: Array of objects with structure: { "section": "group name or null", "name": "ingredient name", "qty": number, "unit": "measurement unit", "notes": "optional notes like 'chopped' or 'divided'" }

For ingredient sections:
- Many recipes group ingredients under sub-headings like "Chicken:", "Sauce:", "For the marinade:", "Dry ingredients:", "Green Sauce:", etc.
- When ingredients are grouped this way, set the "section" field to the group name (e.g., "Chicken", "Sauce", "Green Sauce")
- When a recipe has no sub-groups (all ingredients in one flat list), set section to null for all ingredients
- Preserve the order of sections as they appear in the original recipe
- CRITICAL: The JSON-LD structured data often lists ingredients as a FLAT array without sections. You MUST check the HTML for ingredient group headers. Common patterns:
  - WPRM plugin: <span class="wprm-recipe-group-name">Chicken:</span> or <h4 class="wprm-recipe-group-name">Seasoning</h4> followed by ingredient list items
  - Bold headings within ingredient lists: <strong>For the sauce:</strong> or <b>Marinade:</b>
  - HTML headings: <h3>, <h4> tags within the ingredient section
  - Div groups: <div class="wprm-recipe-ingredient-group"> wrapping a group name + ingredients
- When the HTML shows ingredient groupings, ALWAYS use those groups even if the JSON-LD data is flat

For ingredients:
- Extract the quantity as a number (convert fractions to decimals: 1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75)
- Use standard units: cup, tbsp, tsp, oz, lb, gram, kg, count, slices, can, package
- For bacon, use "slices" as the unit (not "count")
- If no quantity is specified, use qty: 1 and unit: "to taste"
- Put preparation notes (chopped, diced, etc.) in the notes field

Return ONLY a valid JSON object with this exact structure. No markdown, no explanation.`

function extractOgImage(html) {
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  if (ogMatch) return ogMatch[1]

  const twMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i)
  if (twMatch) return twMatch[1]

  const ldMatch = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+)"/i)
  if (ldMatch) return ldMatch[1]

  return null
}

function extractJsonLdRecipe(html) {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])

      // Direct Recipe object
      if (data['@type'] === 'Recipe') return data

      // @graph array (common in WordPress/Yoast)
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        const recipe = data['@graph'].find(item => item['@type'] === 'Recipe')
        if (recipe) return recipe
      }

      // Array of objects
      if (Array.isArray(data)) {
        const recipe = data.find(item => item['@type'] === 'Recipe')
        if (recipe) return recipe
      }
    } catch (_) {
      // Invalid JSON in this script block, skip
    }
  }
  return null
}

function extractByClass(html, className) {
  // Match class name within an HTML class attribute to skip CSS/JS/href references
  const regex = new RegExp(`class="[^"]*${className}[^"]*"`, 'i')
  const match = regex.exec(html)
  if (!match) return null

  const tagStart = html.lastIndexOf('<', match.index)
  if (tagStart === -1) return null

  const chunk = html.slice(tagStart, tagStart + 50000)
  return chunk.length > 200 ? chunk : null
}

function extractSectionHints(html) {
  const hints = []
  const regex = /class="[^"]*wprm-recipe-group-name[^"]*"[^>]*>([^<]+)</gi
  let match
  while ((match = regex.exec(html)) !== null) {
    hints.push(match[1].trim().replace(/:$/, ''))
  }
  return hints
}

function parseIngredientLine(line) {
  // Parse "1 1/2 cups flour, sifted" into { qty, unit, name, notes }
  const fractionMap = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 0.333, '⅔': 0.667, '⅛': 0.125 }
  let text = line.trim()
  for (const [char, val] of Object.entries(fractionMap)) {
    text = text.replace(char, val.toString())
  }
  // Convert "1/2" style fractions
  text = text.replace(/(\d+)\/(\d+)/g, (_, n, d) => (parseInt(n) / parseInt(d)).toString())

  const units = ['cups?', 'tbsp', 'tablespoons?', 'tsp', 'teaspoons?', 'oz', 'ounces?', 'lbs?', 'pounds?', 'grams?', 'kg', 'ml', 'liters?', 'quarts?', 'pints?', 'gallons?', 'cans?', 'packages?', 'slices?', 'cloves?', 'heads?', 'bunche?s?', 'stalks?', 'pieces?', 'sprigs?']
  const unitPattern = new RegExp(`^([\\d.]+(?:\\s+[\\d.]+)?)\\s+(${units.join('|')})\\b\\.?\\s+(.+)`, 'i')
  const qtyOnlyPattern = /^([\d.]+(?:\s+[\d.]+)?)\s+(.+)/

  let qty = 1, unit = 'count', name = text, notes = null

  // Split notes from name on comma
  const commaIdx = text.indexOf(',')
  let mainPart = text
  if (commaIdx > 0) {
    mainPart = text.slice(0, commaIdx).trim()
    notes = text.slice(commaIdx + 1).trim() || null
  }

  const unitMatch = mainPart.match(unitPattern)
  if (unitMatch) {
    qty = parseFloat(unitMatch[1].replace(/\s+/g, '+').split('+').reduce((a, b) => parseFloat(a) + parseFloat(b), 0)) || parseFloat(unitMatch[1])
    unit = unitMatch[2].toLowerCase().replace(/s$/, '')
    name = unitMatch[3].trim()
  } else {
    const qtyMatch = mainPart.match(qtyOnlyPattern)
    if (qtyMatch) {
      qty = parseFloat(qtyMatch[1]) || 1
      name = qtyMatch[2].trim()
    } else {
      name = mainPart
    }
  }

  // Normalize unit names
  if (['tablespoon', 'tablespoons'].includes(unit)) unit = 'tbsp'
  if (['teaspoon', 'teaspoons'].includes(unit)) unit = 'tsp'
  if (['ounce'].includes(unit)) unit = 'oz'
  if (['pound'].includes(unit)) unit = 'lb'

  return { qty, unit, name, notes }
}

function stripPageChrome(html) {
  let cleaned = html
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<div[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*widget[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*(?:adthrive|ad-container|advertisement|sponsored)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*(?:social-share|share-buttons|post-share)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*(?:related-posts|you-might-also|recommended)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

  cleaned = stripScriptsAndStyles(cleaned)
  cleaned = cleaned.replace(/\s{3,}/g, '\n')
  return cleaned
}

function extractRecipeHtml(html) {
  // Try recipe plugin containers in order of popularity
  const pluginClasses = [
    'wprm-recipe-container',   // WP Recipe Maker
    'tasty-recipes',           // Tasty Recipes
    'mv-create-card',          // Mediavine Create
    'recipe-card',             // Generic recipe card themes
    'easyrecipe',              // EasyRecipe
    'zlrecipe-container',      // ZipList/Zip Recipes
    'wprm-recipe',             // WPRM alternate class
    'recipe-content',          // Common generic class
  ]

  for (const cls of pluginClasses) {
    const result = extractByClass(html, cls)
    if (result) return stripScriptsAndStyles(result)
  }

  // Try schema.org Recipe itemtype (microdata)
  const schemaMatch = html.match(/<[^>]*itemtype="[^"]*schema\.org\/Recipe[^"]*"[^>]*>/i)
  if (schemaMatch) {
    const startIdx = html.indexOf(schemaMatch[0])
    const chunk = html.slice(startIdx, startIdx + 50000)
    if (chunk.length > 200) return stripScriptsAndStyles(chunk)
  }

  // Fallback: strip page chrome (nav, sidebar, ads, etc.) for cleaner content
  return stripPageChrome(html)
}

function stripScriptsAndStyles(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
}

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
      formats: ['rawHtml', 'html', 'markdown'],
    }),
  })

  if (!fcResp.ok) {
    const errText = await fcResp.text()
    throw new Error(`Firecrawl failed: ${errText}`)
  }

  const fcData = await fcResp.json()
  // Prefer rawHtml (preserves JSON-LD scripts + ingredient group markup)
  return fcData.data?.rawHtml || fcData.data?.html || fcData.data?.markdown || ''
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

    // Extract og:image from HTML before processing
    const ogImage = extractOgImage(content)

    // Extract structured recipe data and focused recipe HTML
    const jsonLdRecipe = extractJsonLdRecipe(content)
    const recipeHtml = extractRecipeHtml(content)

    // Build context for Claude with structured data + focused HTML
    const contextParts = [RECIPE_PROMPT]

    if (jsonLdRecipe) {
      contextParts.push(`\n--- JSON-LD STRUCTURED DATA ---\n${JSON.stringify(jsonLdRecipe, null, 2)}`)
    }

    contextParts.push(`\n--- RECIPE HTML (check for ingredient group headers) ---\n${recipeHtml.slice(0, 40000)}`)

    // Extract ingredient section hints from WPRM markup and tell Claude directly
    const sectionHints = extractSectionHints(content)
    if (sectionHints.length > 0) {
      contextParts.push(`\n--- DETECTED INGREDIENT SECTIONS ---\nThe recipe HTML has these ingredient group headers: ${sectionHints.map(s => `"${s}"`).join(', ')}. You MUST assign each ingredient to the correct section.\n---`)
    }

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
              text: contextParts.join('\n'),
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

    // Fallback: if Claude returned 0 ingredients but JSON-LD has them, parse directly
    if (recipe.ingredients.length === 0 && jsonLdRecipe?.recipeIngredient?.length > 0) {
      recipe.ingredients = jsonLdRecipe.recipeIngredient.map(line => {
        const parsed = parseIngredientLine(String(line))
        return { section: null, ...parsed }
      })
    }

    // Use og:image as fallback if Claude didn't extract an image
    if (!recipe.image_url && ogImage) {
      recipe.image_url = ogImage
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
