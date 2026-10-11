// Query keys and per-table freshness. Every household list is keyed by the
// household id; inventory is ONE list for all locations so the Kitchen
// switcher never hits the network.
export const keys = {
  grocery: (hid) => ['grocery_items', hid],
  inventory: (hid) => ['inventory', hid],
  recentlyBought: (hid) => ['recently_bought', hid],
  itemHistory: (hid) => ['item_history', hid],
  recipes: (hid) => ['recipes', hid],
  recipe: (id) => ['recipe', id],
  recipeIngredients: (hid) => ['recipe_ingredients', hid],
  mealPicks: (hid) => ['meal_picks', hid],
  members: (hid) => ['household_members', hid],
}

const MIN = 60 * 1000
export const STALE = {
  grocery: 30 * 1000,
  inventory: 30 * 1000,
  recentlyBought: 5 * MIN,
  itemHistory: 60 * MIN,
  recipes: 5 * MIN,
  recipe: 5 * MIN,
  recipeIngredients: 10 * MIN,
  mealPicks: 1 * MIN,
  members: 24 * 60 * MIN,
}
