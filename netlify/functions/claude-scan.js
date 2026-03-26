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
- "category": MUST be one of: Pasta, Bread, Canned Goods, Dry Goods, Sauces & Condiments, Spices, Snacks, Baking, Beverages, Other
  IMPORTANT: Any bread product (bread, bagels, buns, rolls, tortillas, naan, pita, English muffins, hamburger buns, hot dog buns, sandwich bread, sliced bread, loaf) MUST be "Bread", never "Other".
- "subcategory": for Pasta only (Spaghetti, Penne, Bow Tie (Farfalle), Elbow, Fettuccine, Linguine, Angel Hair, Rigatoni, Rotini, Lasagna, Orzo, Other), null for other categories
- "qty": integer count of how many you see, minimum 1
- "unit": cans for canned goods, boxes for pasta/dry goods, bags for snacks/baking, jars for spices, bottles for sauces/beverages, count for bread
- "confidence": high/medium/low
- "needs_verification": boolean
- "verification_prompt": string if low confidence, null otherwise
Choose the MOST SPECIFIC category. Salsa, ketchup, mustard, hot sauce, mayo, ranch, BBQ sauce, soy sauce = "Sauces & Condiments". Canned beans, soups, tomatoes = "Canned Goods". Rice, flour, sugar, oats = "Dry Goods". Only use "Other" if no other category fits.
Return ONLY a valid JSON array. No markdown, no explanation.`,

  fridge: `You are analyzing a photo of items in a fridge. Identify every food item visible. Count the exact number of each item you can see.
For each item return a JSON object with these keys:
- "name": generic name, no brand
- "category": MUST be one of: Deli Meat, Bacon, Dairy, Condiments, Broth/Stock, Bread, Beverages, Fresh Produce, Other
- "subcategory": for Deli Meat (Black Forest Ham, Honey Ham, Roasted Turkey, Deli Chicken, Salami, Pepperoni, Prosciutto, Other), null for all other categories
- "qty": integer count of how many you see, minimum 1
- "unit": lbs for deli meat, packages for bacon, bottles for condiments, count for produce/dairy/bread/beverages
- "confidence": high/medium/low
- "needs_verification": boolean
- "verification_prompt": string if low confidence, null otherwise
Choose the MOST SPECIFIC category. Milk, cheese, yogurt, butter, eggs, cream, sour cream, cream cheese = "Dairy". Ketchup, mustard, hot sauce, mayo, mayonnaise, ranch, salad dressing, BBQ sauce, soy sauce, Worcestershire, relish, salsa = "Condiments". Broth, stock, bouillon, bone broth, chicken broth, beef broth, vegetable broth = "Broth/Stock". Bread, bagels, buns, rolls, tortillas, pita, English muffins, hamburger buns, hot dog buns, wraps = "Bread". Juice, soda, water, beer, wine, kombucha, iced tea, lemonade, energy drinks = "Beverages". ALL fruits and vegetables go in "Fresh Produce": lettuce, romaine, spinach, kale, tomatoes, carrots, peppers, celery, broccoli, cucumbers, onions, mushrooms, zucchini, apples, oranges, pears, lemons, limes, grapes, berries, avocado, herbs, garlic, ginger. NEVER put a subcategory on "Other". If you can identify what type of item it is, use the matching category with subcategory null. Only use "Other" if no other category fits.
Return ONLY a valid JSON array. No markdown, no explanation.`,

  receipt: `You are reading a grocery receipt. Extract every food/beverage line item. Exclude taxes, fees, non-food items (paper towels, cleaning supplies, etc).
For each item return a JSON object with these keys: "name" (generic product name), "qty" (integer, number purchased, minimum 1), "unit" (count unless weight is shown).
Return ONLY a valid JSON array. No markdown, no explanation.`,

  receipt_inventory: `You are reading a grocery receipt. Extract every food/beverage line item. Exclude taxes, fees, non-food items (paper towels, cleaning supplies, etc).

For each item, decide where it should be stored: "fridge", "freezer", or "pantry". Then assign a category and optional subcategory from the EXACT lists below.

FREEZER categories:
- "Beef" (subcategory: Ribeye, NY Strip, T-Bone, Flank Steak, Sirloin, Brisket, Chuck Roast, Short Ribs, Other)
- "Pork" (subcategory: Pork Chops, Pork Tenderloin, Pork Shoulder, Pork Ribs, Pork Loin, Other)
- "Chicken" (subcategory: Breast, Thighs, Wings, Drumsticks, Whole Chicken, Tenders, Other)
- "Turkey" (subcategory: Turkey Breast, Whole Turkey, Turkey Cutlets, Other)
- "Ground Meat" (subcategory: Ground Beef, Ground Turkey, Ground Chicken, Ground Pork, Italian Sausage, Breakfast Sausage, Kielbasa, Bratwurst, Chorizo, Other)
- "Fish" (subcategory: Salmon, Tilapia, Cod, Halibut, Mahi Mahi, Tuna, Other)
- "Seafood" (subcategory: Shrimp (Raw), Shrimp (Cooked), Scallops, Crab, Lobster, Other)
- "Frozen Produce" (no subcategory)
- "Frozen Meals" (no subcategory)
- "Other" (no subcategory)

FRIDGE categories:
- "Deli Meat" (subcategory: Black Forest Ham, Honey Ham, Roasted Turkey, Deli Chicken, Salami, Pepperoni, Prosciutto, Other)
- "Bacon" (no subcategory)
- "Dairy" (no subcategory) - milk, cheese, yogurt, butter, eggs, cream, sour cream
- "Condiments" (no subcategory) - ketchup, mustard, mayo, ranch, salsa, hot sauce, soy sauce
- "Broth/Stock" (no subcategory)
- "Bread" (no subcategory) - bread, bagels, buns, rolls, tortillas
- "Beverages" (no subcategory) - juice, soda, water, beer, wine, kombucha
- "Fresh Produce" (no subcategory) - ALL fruits and vegetables
- "Other" (no subcategory)

PANTRY categories:
- "Pasta" (subcategory: Spaghetti, Penne, Bow Tie (Farfalle), Elbow, Fettuccine, Linguine, Angel Hair, Rigatoni, Rotini, Lasagna, Orzo, Other)
- "Bread" (no subcategory)
- "Canned Goods" (no subcategory)
- "Dry Goods" (no subcategory) - rice, flour, sugar, oats
- "Sauces & Condiments" (no subcategory)
- "Spices" (no subcategory)
- "Snacks" (no subcategory) - chips, crackers, pretzels
- "Baking" (no subcategory)
- "Oils" (no subcategory)
- "Beverages" (no subcategory)
- "Other" (no subcategory)

UNIT rules: lbs for meats/deli, packages for bacon, cans for canned goods, boxes for pasta/dry goods, bags for snacks/frozen produce/baking, jars for spices, bottles for sauces/condiments/oils/beverages, count for everything else.

STORAGE rules: Raw meats go to freezer. Deli meats, dairy, fresh produce, condiments go to fridge. Canned goods, pasta, dry goods, spices, snacks, oils go to pantry. Bread defaults to pantry unless it clearly needs refrigeration.

For each item return a JSON object with these keys:
- "name": generic name, no brand
- "location": "fridge", "freezer", or "pantry"
- "category": from the category list for that location
- "subcategory": from the subcategory list if applicable, null otherwise
- "qty": integer, minimum 1
- "unit": see unit rules above
- "confidence": high/medium/low
- "needs_verification": boolean (true if unsure about location or category)
- "verification_prompt": string if needs_verification, null otherwise

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
    if (!jsonMatch) {
      console.error('No JSON array found in response:', text.slice(0, 500))
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Could not identify items in this photo. Try a clearer or closer photo.' }),
      }
    }

    let items
    try {
      items = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      console.error('JSON parse failed:', parseErr.message, text.slice(0, 500))
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to parse scan results. Try again.' }),
      }
    }

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
