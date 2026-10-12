// Forgiving quantity parser for manual recipe entry.
//
// The recipe_ingredients.qty column is numeric, so a free-text quantity like
// "1/2", "to taste", or "1-2" would otherwise make the whole save fail (and,
// today, fail silently). This converts what it can to a number and hands back
// any leftover human text so the caller can keep it (e.g. in notes) instead of
// losing it — keeping manual entry forgiving.

import { parseIngredientLine as parseLineShared, parseIngredientRows, formatQty } from './ingredientParse'

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

// Line parsing lives in ingredientParse.js (shared with the Netlify functions).
// These wrappers keep the editor's row shape: amount and unit as typed.
export function parseIngredientLine(line) {
  const r = parseLineShared(line)
  if (!r || r.name === undefined) return null
  return { name: r.name, qty: r.qty_text, unit: r.unit_text, notes: r.notes, section: '' }
}

export function parseIngredientBlock(block) {
  return parseIngredientRows(block)
}

// Build the row to store: a numeric `qty` (for math like "Make This") plus
// `qty_text`, the verbatim string the user typed, so the recipe displays exactly
// as written ("1/2 cup", "to taste") instead of "0.5 cup".
export function normalizeIngredientQty(ing) {
  // Already carries the written amount (imports, scans): keep it, number it.
  if (typeof ing.qty_text === 'string' && ing.qty_text.trim()) {
    const text = ing.qty_text.trim()
    const qty = typeof ing.qty === 'number' && Number.isFinite(ing.qty) ? ing.qty : parseQty(text).qty
    return { ...ing, qty, qty_text: text }
  }
  // A bare number (older imports): write it the way a cook would.
  if (typeof ing.qty === 'number') {
    return { ...ing, qty: Number.isFinite(ing.qty) ? ing.qty : null, qty_text: formatQty(ing.qty) || null }
  }
  const text = ing.qty == null ? '' : String(ing.qty).trim()
  const { qty } = parseQty(text)
  return { ...ing, qty, qty_text: text || null }
}
