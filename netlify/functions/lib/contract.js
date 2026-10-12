import { normalizeUnit, parseIngredientLine, formatQty } from '../../../src/lib/ingredientParse.js'

const str = (v) => (v == null ? '' : String(v)).trim()
const posInt = (v) => {
  const n = typeof v === 'string' ? parseInt(v, 10) : v
  return Number.isInteger(n) && n > 0 ? n : null
}
const validUrl = (v) => {
  const s = str(v)
  try { return /^https?:$/.test(new URL(s).protocol) ? s : null } catch { return null }
}

function instructionsText(v) {
  if (v == null) return null
  if (Array.isArray(v)) {
    const steps = v.map(x => str(typeof x === 'object' ? (x.text ?? x.name) : x)).filter(Boolean)
    return steps.length ? steps.map((s, i) => `${i + 1}. ${s.replace(/^\d+[.)]\s*/, '')}`).join('\n') : null
  }
  const s = str(v)
  return s || null
}

// Model output (or any loose object) -> the import contract.
export function normalizeContract(raw, { sourceUrl = null, via = 'model', fallbackImage = null } = {}) {
  const ingredients = (Array.isArray(raw?.ingredients) ? raw.ingredients : []).map((i) => {
    if (typeof i === 'string') {
      const r = parseIngredientLine(i)
      if (!r || r.name === undefined) return null
      return { section: null, name: r.name, qty: r.qty, qty_text: r.qty_text || null, unit: r.unit || null, notes: r.notes || null }
    }
    const name = str(i?.name)
    if (!name) return null
    let qty_text = str(i.qty_text) || (typeof i.qty === 'number' ? formatQty(i.qty) : null) || null
    let unit = normalizeUnit(i.unit) || null
    // "2 pounds" with unit "lb": the amount is the number, the unit lives in `unit`.
    if (qty_text) {
      const words = qty_text.split(' ')
      const tailUnit = words.length > 1 ? normalizeUnit(words[words.length - 1]) : null
      if (tailUnit) { qty_text = words.slice(0, -1).join(' '); unit = unit || tailUnit }
    }
    let qty = typeof i.qty === 'number' && Number.isFinite(i.qty) ? i.qty : null
    if (qty == null && qty_text) {
      const r = parseIngredientLine(`${qty_text} ${name}`)
      if (r && r.name !== undefined) qty = r.qty
    }
    return { section: str(i.section) || null, name, qty, qty_text, unit, notes: str(i.notes) || null }
  }).filter(Boolean)

  return {
    name: str(raw?.name) || null,
    description: str(raw?.description) || null,
    image_url: validUrl(raw?.image_url) || fallbackImage || null,
    servings: posInt(raw?.servings),
    yield_text: str(raw?.yield_text) || null,
    prep_time: posInt(raw?.prep_time),
    cook_time: posInt(raw?.cook_time),
    total_time: posInt(raw?.total_time),
    tags: (Array.isArray(raw?.tags) ? raw.tags : []).map(str).filter(Boolean).slice(0, 8),
    instructions: instructionsText(raw?.instructions),
    source_url: sourceUrl || null,
    via,
    ingredients,
  }
}

export const NO_RECIPE = "That page doesn't look like a recipe. Double-check the link, or add it with Type it."
export const NO_INGREDIENTS = 'No ingredients found there. Try a different link, or add it with Type it.'
export const NO_RECIPE_TEXT = "That text doesn't look like a recipe. Paste the ingredients and steps, or add it with Type it."
export const NO_INGREDIENTS_TEXT = 'No ingredients found in that text. Paste the ingredient list too, or add it with Type it.'
export const TOO_LONG = 'That is too long to read in one go. Try a shorter page or fewer screenshots.'
export const TOO_SLOW = 'That site took too long to read. Try again, or add it with Type it.'
export const UNREADABLE = "We couldn't read that site. Try again, or add it with Type it."

export const reply = (status, body) => ({ status, body })

export function errorStatus(err) {
  const name = err?.name || ''
  if (err?.code === 'invalid_url') return reply(400, { error: 'That link does not look right. Check it and try again.' })
  if (name === 'TimeoutError' || name === 'AbortError' || name === 'APIConnectionTimeoutError' || /timed out/i.test(err?.message || '')) return reply(504, { error: TOO_SLOW })
  return null
}
