// Decides what to do with pasted recipe text: a bare ingredient list is
// parsed on the phone with no request, anything else goes to the model.
import { parseIngredientText, parseIngredientRows } from '../../lib/ingredientParse'

// A line that opens with an amount, after any bullet or bold marker: a digit,
// a unicode fraction, "a pinch", "pinch of".
const AMOUNT_START = /^(?:[-•*–·▢◻☐]\s*)?(?:\*\*|__)?\s*(?:\d|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞⅐⅑⅒]|an?\s+(?:pinch|dash|splash|handful)\b|(?:pinch|dash|splash|handful)\s+of\b)/i
const MIN_LINES = 2
const MIN_AMOUNT_SHARE = 0.6

export function looksLikeIngredientList(text) {
  const lines = String(text ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < MIN_LINES) return false
  const withAmount = lines.filter(l => AMOUNT_START.test(l)).length
  if (withAmount / lines.length < MIN_AMOUNT_SHARE) return false
  // Numbered steps start with a digit too; the parser knows a step from a row.
  const { ingredients, instructions } = parseIngredientText(text)
  return instructions.length === 0 && ingredients.length >= 2
}

// The local path: editor rows only, the rest of the draft is left alone.
export function draftFromPastedList(text) {
  return { ingredients: parseIngredientRows(text) }
}
