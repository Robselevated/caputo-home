// Meal types for the Cookbook tabs. A recipe's type is stored as one of these
// tags; recipes without one (most imports) get a best guess from their other
// tags and name, and picking a type in the edit form writes the tag.
export const MEAL_TYPES = [
  { key: 'dinner', tag: 'Dinner', label: 'Dinners' },
  { key: 'side', tag: 'Side', label: 'Sides & Apps' },
  { key: 'breakfast', tag: 'Breakfast', label: 'Breakfast' },
  { key: 'dessert', tag: 'Dessert', label: 'Desserts' },
]

const BY_TAG = new Map(MEAL_TYPES.map(t => [t.tag.toLowerCase(), t.key]))

// Checked in order. A "main course" tag settles it as dinner before the side
// words, so tacos tagged "avocado salsa" stay a dinner.
const GUESSES = [
  ['dessert', /\b(desserts?|cookies?|cakes?|cupcakes?|brownies?|blondies?|s'?mores|no-bake|fudge|cheesecake|pies?|cobbler|pudding|candy|apple dumplings?)\b/],
  ['breakfast', /\b(breakfast|brunch|pancakes?|waffles?|french toast|oatmeal|overnight oats|granola|muffins?|egg bake|frittata|quiche)\b/],
  ['dinner', /\b(main course|main dish|entree|dinner)\b/],
  ['side', /\b(sides?|side dish|appetizers?|apps?|starters?|dips?|salsa|guacamole|salads?|snacks?|party food|finger food|slaw)\b/],
]

// Explicit tags (exact match, any case) win over the guess. An import tagged
// for several meals ("breakfast, lunch, dinner") counts as a dinner.
export function explicitMealType(tags) {
  const keys = (tags || []).map(t => BY_TAG.get(String(t).trim().toLowerCase())).filter(Boolean)
  if (keys.length > 1 && keys.includes('dinner')) return 'dinner'
  return keys[0] ?? null
}

export function mealTypeOf(recipe) {
  const explicit = explicitMealType(recipe.tags)
  if (explicit) return explicit
  const tagText = (recipe.tags || []).join(' | ').toLowerCase()
  const name = String(recipe.name || '').toLowerCase()
  // Tags describe the dish better than words in its name ("Breakfast Tacos"
  // aside), so a tag match wins before falling back to the name.
  for (const [key, re] of GUESSES) if (re.test(tagText)) return key
  for (const [key, re] of GUESSES) if (re.test(name)) return key
  return 'dinner'
}

// Tags with exactly one meal type tag: `key`'s.
export function withMealType(tags, key) {
  const type = MEAL_TYPES.find(t => t.key === key)
  const rest = (tags || []).filter(t => !BY_TAG.has(String(t).trim().toLowerCase()))
  return type ? [type.tag, ...rest] : rest
}

// A re-import replaces tags with the site's; keep the type the cook chose.
export function keepMealType(oldTags, newTags) {
  const chosen = explicitMealType(oldTags)
  return chosen ? withMealType(newTags, chosen) : newTags
}
