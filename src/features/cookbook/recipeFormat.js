// Display helpers shared by the cookbook pages. No React in here so the
// hook tests and the page tests can import it freely.

export const COOKBOOK_CATEGORIES = ['Italian', 'Korean', 'Mexican', 'Breakfast', 'Dessert', 'Chicken', 'Ground Beef', 'Pork']

// Ingredients keep their stored order; a section header appears only where
// the section changes, so "Sauce" rows stay together without re-sorting.
export function groupBySection(ingredients = []) {
  const groups = []
  for (const ing of ingredients) {
    const name = ing.section || ''
    const last = groups[groups.length - 1]
    if (last && last.name === name) last.items.push(ing)
    else groups.push({ name, items: [ing] })
  }
  return groups
}

// Instructions arrive as free text. One step per line is the common case;
// a single long paragraph gets split on sentence boundaries instead.
export function splitSteps(text) {
  const lines = String(text || '')
    .split(/\n/)
    .map(line => line.replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean)
  if (lines.length === 1 && lines[0].length > 100) {
    return lines[0]
      .split(/\.\s+(?=[A-Z])/)
      .map(s => s.replace(/\.$/, '').trim())
      .filter(Boolean)
      .map(s => `${s}.`)
  }
  return lines
}

// "1/2 lb, ground": the quantity exactly as typed, then unit, then any note.
export function ingredientDetail(ing) {
  const qty = ing.qty_text ?? (ing.qty != null && ing.qty !== '' ? ing.qty : null)
  const amount = [qty, ing.unit].filter(v => v != null && v !== '').join(' ')
  return [amount, ing.notes].filter(Boolean).join(', ')
}

export function recipeMeta(recipe) {
  const total = (Number(recipe.prep_time) || 0) + (Number(recipe.cook_time) || 0)
  const parts = []
  if (total) parts.push(`${total} min`)
  if (recipe.servings) parts.push(`${recipe.servings} serving${Number(recipe.servings) === 1 ? '' : 's'}`)
  return parts.join(', ')
}

export function coverageLabel(cov) {
  if (!cov || !cov.total) return null
  const missing = cov.total - cov.matched
  return missing === 0 ? 'Have it all' : `${missing} to buy`
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// Postgres and PostgREST codes the cookbook can hit, in plain words. Raw
// database text ("invalid input syntax for type numeric") never reaches the
// screen.
const DB_MESSAGES = {
  '22P02': 'One of the amounts is not a number we can save. Check the quantities and try again.',
  '22003': 'One of the amounts is too large to save.',
  '23502': 'The recipe needs a name.',
  '23503': 'That recipe no longer exists.',
  '42501': 'You do not have access to this recipe.',
  'PGRST301': 'You do not have access to this recipe.',
  'P0002': 'That recipe no longer exists.',
}

export function friendlyDbError(error) {
  return DB_MESSAGES[error?.code] || 'Could not save the recipe. Try again.'
}

export function errorText(error, fallback) {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error.code) return friendlyDbError(error)
  return error.message || fallback
}
