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

// Coerce an ingredient's free-text qty into a numeric qty, stashing any
// non-numeric remainder into notes so nothing the user typed is lost.
export function normalizeIngredientQty(ing) {
  const { qty, leftover } = parseQty(ing.qty)
  let notes = ing.notes ?? null
  if (leftover) {
    notes = notes ? `${notes} (${leftover})` : leftover
  }
  return { ...ing, qty, notes }
}
