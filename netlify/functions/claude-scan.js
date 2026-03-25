import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })

const SYSTEM_PROMPTS = {
  freezer: `You are analyzing a photo of items in a freezer. Identify every food item visible. Count the exact number of each item you can see.
For each item return a JSON object with these keys:
- "name": generic name, no brand (e.g. "Black Beans" not "Bush's Black Beans")
- "category": MUST be one of: Beef, Pork, Chicken, Turkey, Ground Meat, Fish, Seafood, Frozen Produce, Frozen Meals, Other
- "subcategory": for Beef (Ribeye, NY Strip, T-Bone, Flank Steak, Sirloin, Brisket, Chuck Roast, Short Ribs, Other), for Pork (Pork Chops, Pork Tenderloin, Pork Shoulder, Pork Ribs, Pork Loin, Other), for Chicken (Breast, Thighs, Wings, Drumsticks, Whole Chicken, Tenders, Other), for Ground Meat (Ground Beef, Ground Turkey, Ground Chicken, Ground Pork, Italian Sausage, Breakfast Sausage, Kielbasa, Bratwurst, Chorizo, Other), for Fish (Salmon, Tilapia, Cod, Halibut, Mahi Mahi, Tuna, Other), for Seafood (Shrimp (Raw), Shrimp (Cooked), Scallops, Crab, Lobster, Other), null for other categories
- "qty": integer count of how many you see, minimum 1
- "unit": lbs for meats, bags for frozen produce, count for frozen meals
- "confidence": high/medium/low
- "needs_verification": boolean
- "verification_prompt": string if low confidence, null otherwise
Choose the MOST SPECIFIC category. Only use "Other" if no other category fits.
Return ONLY a valid JSON array. No markdown, no explanation.`,

  pantry: `You are analyzing a photo of items in a pantry. Identify every food item visible. Count the exact number of each item you can see.
For each item return a JSON object with these keys:
- "name": generic name, no brand
- "category": MUST be one of: Pasta, Canned Goods, Dry Goods, Sauces & Condiments, Spices, Snacks, Baking, Beverages, Other
- "subcategory": for Pasta only (Spaghetti, Penne, Bow Tie (Farfalle), Elbow, Fettuccine, Linguine, Angel Hair, Rigatoni, Rotini, Lasagna, Orzo, Other), null for other categories
- "qty": integer count of how many you see, minimum 1
- "unit": cans for canned goods, boxes for pasta/dry goods, bags for snacks/baking, jars for spices, bottles for sauces/beverages
- "confidence": high/medium/low
- "needs_verification": boolean
- "verification_prompt": string if low confidence, null otherwise
Choose the MOST SPECIFIC category. Salsa, ketchup, mustard, hot sauce = "Sauces & Condiments". Canned beans, soups, tomatoes = "Canned Goods". Rice, flour, sugar, oats = "Dry Goods". Only use "Other" if no other category fits.
Return ONLY a valid JSON array. No markdown, no explanation.`,

  fridge: `You are analyzing a photo of items in a fridge. Identify every food item visible. Count the exact number of each item you can see.
For each item return a JSON object with these keys:
- "name": generic name, no brand
- "category": MUST be one of: Deli Meat, Bacon, Lettuce, Apples, Oranges, Pears, Dairy, Produce (Other), Other
- "subcategory": for Deli Meat (Black Forest Ham, Honey Ham, Roasted Turkey, Deli Chicken, Salami, Pepperoni, Prosciutto, Other), for Lettuce (Romaine, Iceberg, Green Leaf, Kale, Spinach, Arugula, Mixed Greens, Other), for Apples (Fuji, Gala, Granny Smith, Honeycrisp, Pink Lady, Other), null for other categories
- "qty": integer count of how many you see, minimum 1
- "unit": lbs for deli meat, packages for bacon, count for produce/dairy
- "confidence": high/medium/low
- "needs_verification": boolean
- "verification_prompt": string if low confidence, null otherwise
Choose the MOST SPECIFIC category. Milk, cheese, yogurt, butter, eggs, cream = "Dairy". Carrots, peppers, celery, tomatoes, berries = "Produce (Other)". Only use "Other" if no other category fits.
Return ONLY a valid JSON array. No markdown, no explanation.`,

  receipt: `You are reading a grocery receipt. Extract every food/beverage line item. Exclude taxes, fees, non-food items (paper towels, cleaning supplies, etc).
For each item return a JSON object with these keys: "name" (generic product name), "qty" (integer, number purchased, minimum 1), "unit" (count unless weight is shown).
Return ONLY a valid JSON array. No markdown, no explanation.`,
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { image_url, image_base64, media_type, scan_type } = JSON.parse(event.body)

    if ((!image_url && !image_base64) || !scan_type) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing image (image_url or image_base64) or scan_type' }) }
    }

    const systemPrompt = SYSTEM_PROMPTS[scan_type]
    if (!systemPrompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid scan_type' }) }
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
              text: systemPrompt,
            },
          ],
        },
      ],
    })

    const text = response.content[0].text
    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const items = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    }
  } catch (err) {
    console.error('Scan error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Scan processing failed' }),
    }
  }
}
