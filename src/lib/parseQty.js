// Forgiving quantity parser for manual recipe entry.
//
// The recipe_ingredients.qty column is numeric, so a free-text quantity like
// "1/2", "to taste", or "1-2" would otherwise make the whole save fail (and,
// today, fail silently). This converts what it can to a number and hands back
// any leftover human text so the caller can keep it (e.g. in notes) instead of
// losing it — keeping manual entry forgiving.

const UNICODE_FRACTIONS = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅐': 1 / 7, '⅑': 1 / 9, '⅒': 0.1,
}

function round(n) {
  return Math.round(n * 1000) / 1000
}

// Returns { qty: number|null, leftover: string|null }.
export function parseQty(raw) {
  if (raw == null) return { qty: null, leftover: null }
  if (typeof raw === 'number') return { qty: raw, leftover: null }
  const s = String(raw).trim()
  if (!s) return { qty: null, leftover: null }

  // Plain number, e.g. "2" or "1.5"
  if (/^\d+(\.\d+)?$/.test(s)) return { qty: parseFloat(s), leftover: null }

  // Whole + unicode fraction, e.g. "1½" / "½"
  const uni = s.match(/^(\d+)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞⅐⅑⅒])$/)
  if (uni) {
    const whole = uni[1] ? parseInt(uni[1], 10) : 0
    return { qty: round(whole + UNICODE_FRACTIONS[uni[2]]), leftover: null }
  }

  // Mixed number, e.g. "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed && parseInt(mixed[3], 10) !== 0) {
    return { qty: round(parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10)), leftover: null }
  }

  // Simple fraction, e.g. "1/2"
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (frac && parseInt(frac[2], 10) !== 0) {
    return { qty: round(parseInt(frac[1], 10) / parseInt(frac[2], 10)), leftover: null }
  }

  // Leading number then text, e.g. "2 (or 3)" — keep the number, preserve the text.
  const lead = s.match(/^(\d+(?:\.\d+)?)\s+(.+)$/)
  if (lead) return { qty: parseFloat(lead[1]), leftover: lead[2] }

  // Not a number at all ("to taste", "a pinch", "1-2") — keep it as text.
  return { qty: null, leftover: s }
}

const UNIT_WORDS = new Set([
  'cups', 'cup', 'tbsp', 'tablespoons', 'tablespoon', 'tsp', 'teaspoons', 'teaspoon',
  'oz', 'ounces', 'ounce', 'lbs', 'lb', 'pounds', 'pound', 'grams', 'gram', 'g', 'kg',
  'ml', 'liters', 'liter', 'l', 'quarts', 'quart', 'pints', 'pint', 'gallons', 'gallon',
  'cans', 'can', 'packages', 'package', 'pkg', 'slices', 'slice', 'cloves', 'clove',
  'heads', 'head', 'bunches', 'bunch', 'stalks', 'stalk', 'pieces', 'piece', 'sprigs',
  'sprig', 'sticks', 'stick', 'pinch', 'dash', 'handful', 'count',
])

// Forgivingly parse one pasted line ("2 cups flour, sifted") into an ingredient
// row. Anything it can't split confidently just lands in `name`, so nothing is lost.
export function parseIngredientLine(line) {
  let text = String(line || '').trim()
  text = text.replace(/^\s*[-•*]\s*/, '').replace(/^\s*\d+[.)]\s+/, '') // strip bullets / "1. "
  if (!text) return null

  let notes = ''
  const comma = text.indexOf(',')
  let main = text
  if (comma > 0) {
    main = text.slice(0, comma).trim()
    notes = text.slice(comma + 1).trim()
  }

  let qty = ''
  let rest = main
  const qtyMatch = main.match(/^((?:\d+\s+\d+\/\d+)|(?:\d+\s*\/\s*\d+)|(?:\d+(?:\.\d+)?)|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])\s*/)
  if (qtyMatch) {
    qty = qtyMatch[1].trim()
    rest = main.slice(qtyMatch[0].length).trim()
  }

  let unit = ''
  const firstWord = rest.split(/\s+/)[0] || ''
  if (UNIT_WORDS.has(firstWord.toLowerCase().replace(/\.$/, ''))) {
    unit = firstWord.replace(/\.$/, '')
    rest = rest.slice(firstWord.length).trim()
  }

  return { name: rest || main, qty, unit, notes, section: '' }
}

// Parse a pasted block (one ingredient per line) into ingredient rows.
export function parseIngredientBlock(block) {
  return String(block || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseIngredientLine)
    .filter(Boolean)
}

// Build the row to store: a numeric `qty` (for math like "Make This") plus
// `qty_text`, the verbatim string the user typed, so the recipe displays exactly
// as written ("1/2 cup", "to taste") instead of "0.5 cup".
export function normalizeIngredientQty(ing) {
  const text = ing.qty == null ? '' : String(ing.qty).trim()
  const { qty } = parseQty(text)
  return { ...ing, qty, qty_text: text || null }
}
