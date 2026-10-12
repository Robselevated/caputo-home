// The import contract the model fills. Shared by link, text and image parsing.
export const CONTRACT = `Return ONLY a JSON object, no markdown fences, no commentary, with exactly these keys:
{
  "name": string or null (the recipe title; null when none is visible, never invent one),
  "description": string or null (one sentence),
  "servings": integer or null,
  "yield_text": string or null (the yield as written, e.g. "4-6 servings", "makes 12 muffins"),
  "prep_time": integer minutes or null,
  "cook_time": integer minutes or null,
  "total_time": integer minutes or null,
  "tags": array of up to 6 short strings (cuisine, meal type, diet),
  "image_url": string or null (only a real full URL present in the content),
  "instructions": string or null (numbered steps separated by newlines: "1. ...\\n2. ..."),
  "ingredients": array of { "section": string or null, "name": string, "qty_text": string or null, "qty": number or null, "unit": string or null, "notes": string or null }
}
Ingredient rules:
- qty_text is the amount only, exactly as written, never the unit: "1-2", "1 1/2", "½", "8", "to taste", "pinch". For "1 (15 oz) can beans" it is "1". Keep ranges and fractions. null when there is no amount.
- qty is the best single number for math: the low end of a range, fractions as decimals, null for "to taste" or no amount.
- unit is one of: cup, tbsp, tsp, oz, fl oz, lb, g, kg, ml, l, quart, pint, gallon, can, jar, bottle, box, bag, package, envelope, stick, slice, clove, head, bunch, stalk, piece, sprig, pinch, dash, handful, count. null when none applies. A package size like "(15 oz)" goes in notes with unit "can".
- name is the ingredient only: no amount, no unit. Preparation ("chopped", "divided", "optional") goes in notes.
- section is the group heading the ingredient sits under ("For the sauce"), or null when the list is flat. Keep the original order and every ingredient.
Ignore comments, ads, nutrition facts, equipment lists, and any other recipe on the page.`

export const RECIPE_TEXT_PROMPT = `You turn recipe text (a web page's text, a pasted recipe, a social post, or a chat transcript) into structured JSON for a family cookbook app.
${CONTRACT}
If the text contains no recipe, return {"name": null, "ingredients": []}.`

export const RECIPE_IMAGE_PROMPT = `You read recipes from photos and screenshots for a family cookbook app. The images may be a cookbook page, a handwritten card, a printed recipe, a phone screenshot of a website, or screenshots of a chat with an AI assistant (dark or light theme).
Several images may be consecutive screenshots of one recipe with overlapping lines: merge them into ONE recipe without repeating an ingredient or a step, in reading order.
In chat screenshots ignore the app chrome, the person's own messages, greetings, preamble and follow-up chatter; read only the recipe itself.
Transcribe text exactly as it appears. Do not guess at words you cannot read; leave them out.
${CONTRACT}
If no recipe is readable, return {"name": null, "ingredients": []}.`
