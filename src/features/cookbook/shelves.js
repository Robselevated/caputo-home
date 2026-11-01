import { toDateKey, addDays } from '../../lib/week'

const QUICK_MINUTES = 30
const NEW_DAYS = 30
const LATELY_DAYS = 21
const SLOW_COOKER = /\b(crock ?pot|slow[ -]?cook(er)?)\b/i

export const totalMinutes = (r) => (r.prep_time || 0) + (r.cook_time || 0)
const byName = (a, b) => a.name.localeCompare(b.name)

// The last day each recipe sat on the Planning calendar, up to today.
export function lastMadeByRecipe(picks, today = new Date()) {
  const todayKey = toDateKey(today)
  const map = new Map()
  for (const p of picks ?? []) {
    if (!p.recipe_id || !p.planned_for || p.planned_for > todayKey) continue
    if (!map.has(p.recipe_id) || map.get(p.recipe_id) < p.planned_for) map.set(p.recipe_id, p.planned_for)
  }
  return map
}

// Swipe rows for one tab's recipes, empty ones left out. A recipe can sit on
// several shelves; the full grid below them still lists everything once.
export function buildShelves(recipes, { readyIds = new Set(), lastMade = new Map(), today = new Date() } = {}) {
  const newSince = addDays(today, -NEW_DAYS).getTime()
  const latelyKey = toDateKey(addDays(today, -LATELY_DAYS))
  const shelves = [
    {
      key: 'ready',
      title: 'Ready to cook',
      hint: 'Everything is in the kitchen',
      recipes: recipes.filter(r => readyIds.has(r.id)).sort(byName),
    },
    {
      key: 'quick',
      title: `Quick, ${QUICK_MINUTES} min or less`,
      recipes: recipes.filter(r => totalMinutes(r) > 0 && totalMinutes(r) <= QUICK_MINUTES).sort((a, b) => totalMinutes(a) - totalMinutes(b) || byName(a, b)),
    },
    {
      key: 'slow',
      title: 'Slow cooker',
      recipes: recipes.filter(r => SLOW_COOKER.test(r.name) || (r.tags || []).some(t => SLOW_COOKER.test(t))).sort(byName),
    },
    {
      key: 'lately',
      title: "Haven't made lately",
      recipes: recipes.filter(r => lastMade.has(r.id) && lastMade.get(r.id) < latelyKey).sort((a, b) => lastMade.get(a.id).localeCompare(lastMade.get(b.id))),
    },
    {
      key: 'new',
      title: 'New this month',
      recipes: recipes.filter(r => new Date(r.created_at).getTime() >= newSince).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    },
  ]
  return shelves.filter(s => s.recipes.length > 0)
}
