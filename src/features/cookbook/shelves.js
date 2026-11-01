import { addDays } from '../../lib/week'
import { MEAL_TYPES, mealTypeOf } from './mealType'

const QUICK_MINUTES = 30
const NEW_DAYS = 30
const SLOW_COOKER = /\b(crock ?pot|slow[ -]?cook(er)?)\b/i

export const totalMinutes = (r) => (r.prep_time || 0) + (r.cook_time || 0)
const byName = (a, b) => a.name.localeCompare(b.name)

// The Cookbook tabs past All, in bar order. Each picks and orders its own
// recipes; `ctx` carries what isn't on the recipe (kitchen coverage, today).
export const COLLECTIONS = [
  {
    key: 'ready',
    label: 'Ready to cook',
    empty: 'Recipes with every ingredient in the kitchen show up here',
    pick: (rs, { readyIds }) => rs.filter(r => readyIds.has(r.id)).sort(byName),
  },
  {
    key: 'quick',
    label: 'Quick 30 min',
    title: `Quick, ${QUICK_MINUTES} min or less`,
    pick: (rs) => rs.filter(r => totalMinutes(r) > 0 && totalMinutes(r) <= QUICK_MINUTES).sort((a, b) => totalMinutes(a) - totalMinutes(b) || byName(a, b)),
  },
  {
    key: 'slow',
    label: 'Slow cooker',
    pick: (rs) => rs.filter(r => SLOW_COOKER.test(r.name) || (r.tags || []).some(t => SLOW_COOKER.test(t))).sort(byName),
  },
  {
    key: 'new',
    label: 'New this month',
    pick: (rs, { today }) => {
      const since = addDays(today, -NEW_DAYS).getTime()
      return rs.filter(r => new Date(r.created_at).getTime() >= since).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    },
  },
  ...['breakfast', 'dinner', 'side', 'dessert'].map(key => {
    const type = MEAL_TYPES.find(t => t.key === key)
    return {
      key,
      label: type.label,
      empty: "Set a recipe's meal type on its edit page",
      pick: (rs) => rs.filter(r => mealTypeOf(r) === key).sort(byName),
    }
  }),
]

export function collectionFor(key) {
  return COLLECTIONS.find(c => c.key === key) ?? null
}

export function pickCollection(key, recipes, { readyIds = new Set(), today = new Date() } = {}) {
  const c = collectionFor(key)
  return c ? c.pick([...recipes], { readyIds, today }) : []
}
