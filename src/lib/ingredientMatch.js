/**
 * Smart ingredient matching — strips qualifiers and checks
 * if a recipe ingredient name matches any inventory item name.
 */

// Common qualifiers that get stripped before matching
const QUALIFIERS = [
  'all-purpose', 'all purpose', 'kosher', 'freshly ground', 'fresh',
  'ground', 'dried', 'dry', 'organic', 'unsalted', 'salted', 'extra-virgin',
  'extra virgin', 'light', 'dark', 'raw', 'cooked', 'frozen', 'canned',
  'diced', 'chopped', 'minced', 'sliced', 'shredded', 'grated', 'crushed',
  'whole', 'large', 'medium', 'small', 'thin', 'thick', 'fine', 'coarse',
  'sweet', 'hot', 'mild', 'smoked', 'roasted', 'toasted', 'blanched',
  'peeled', 'deveined', 'boneless', 'skinless', 'bone-in', 'skin-on',
  'low-sodium', 'low sodium', 'reduced-fat', 'reduced fat', 'fat-free',
  'plain', 'pure', 'real', 'natural', 'unbleached', 'bleached',
  'granulated', 'powdered', 'confectioners', 'brown', 'white',
  'flat-leaf', 'flat leaf', 'Italian', 'Japanese', 'Chinese',
]

// Direct aliases: recipe name -> inventory name it should match
const ALIASES = {
  'scallion': 'green onion',
  'scallions': 'green onions',
  'green onion': 'scallion',
  'green onions': 'scallions',
  'cilantro': 'coriander',
  'coriander': 'cilantro',
  'heavy cream': 'heavy whipping cream',
  'heavy whipping cream': 'heavy cream',
  'cornstarch': 'corn starch',
  'corn starch': 'cornstarch',
  'baking soda': 'bicarbonate of soda',
  'bell pepper': 'pepper',
  'garlic cloves': 'garlic',
  'garlic clove': 'garlic',
  'egg': 'eggs',
  'eggs': 'egg',
  'lemon juice': 'lemon',
  'lime juice': 'lime',
  'soy sauce': 'soy sauce',
  'parmesan cheese': 'parmesan',
  'parmesan': 'parmesan cheese',
  'mozzarella cheese': 'mozzarella',
  'mozzarella': 'mozzarella cheese',
  'cheddar cheese': 'cheddar',
  'cheddar': 'cheddar cheese',
}

/**
 * Normalize an ingredient name by lowercasing and stripping qualifiers.
 * "Freshly Ground Black Pepper" -> "black pepper"
 * "All-Purpose Flour" -> "flour"
 */
function normalize(name) {
  let n = name.toLowerCase().trim()
  for (const q of QUALIFIERS) {
    // Replace qualifier as whole word (with word boundary-ish logic)
    const re = new RegExp(`\\b${q}\\b`, 'gi')
    n = n.replace(re, '')
  }
  // Collapse whitespace
  return n.replace(/\s+/g, ' ').trim()
}

/**
 * Check if a recipe ingredient name matches an inventory item name.
 * Uses normalization, substring matching, and aliases.
 */
function namesMatch(recipeName, inventoryName) {
  const rNorm = normalize(recipeName)
  const iNorm = normalize(inventoryName)

  // Exact match after normalization
  if (rNorm === iNorm) return true

  // One contains the other (handles "flour" matching "all-purpose flour"
  // and "black pepper" matching "freshly ground black pepper")
  if (rNorm.includes(iNorm) || iNorm.includes(rNorm)) return true

  // Check aliases
  const rAlias = ALIASES[rNorm]
  if (rAlias) {
    const aNorm = normalize(rAlias)
    if (aNorm === iNorm || aNorm.includes(iNorm) || iNorm.includes(aNorm)) return true
  }

  return false
}

/**
 * Find the best matching inventory item for a recipe ingredient name.
 * Returns the matched item or null.
 */
export function findMatch(ingredientName, inventoryItems) {
  // First pass: exact lowercase match (fast path)
  const lower = ingredientName.toLowerCase()
  const exact = inventoryItems.find(item => item.name.toLowerCase() === lower)
  if (exact) return exact

  // Second pass: smart matching
  return inventoryItems.find(item => namesMatch(ingredientName, item.name)) || null
}

/**
 * Check if a recipe ingredient name matches any name in a Set of
 * lowercased inventory names. Used by useIngredientCoverage for
 * bulk coverage calculations.
 */
export function hasMatch(ingredientName, inventoryNameSet) {
  const lower = ingredientName.toLowerCase()

  // Fast path: exact match
  if (inventoryNameSet.has(lower)) return true

  // Smart match against every name in the set
  for (const invName of inventoryNameSet) {
    if (namesMatch(ingredientName, invName)) return true
  }

  return false
}
