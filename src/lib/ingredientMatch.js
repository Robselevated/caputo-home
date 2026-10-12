// Ingredient matching: does a recipe ingredient name refer to something in the
// kitchen? Names are normalised to tokens (lowercase, no punctuation or
// parentheticals, qualifiers stripped, plurals folded) and compared as lists:
//
//   exact   the token lists are equal                              score 3
//   alias   one side's alias (scallion -> green onion) is exact    score 2
//   subset  both have two or more tokens, one list is a subset of
//           the other and the last token (the head noun) agrees    score 1
//
// A single-token name matches only exactly or by alias, so "ham" is not in
// "graham crackers", "rice" is not "rice vinegar" and "oil" is not "chili
// oil". A name that normalises to nothing matches nothing.
import { normalizeUnit } from './ingredientParse'

// Words that describe an ingredient without changing what it is. Stripped
// before comparing, except the last remaining word of a name.
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

// Qualifiers that change what the ingredient is when both names carry one
// and they disagree: brown sugar is not white sugar.
const MEANINGFUL = new Set(['brown', 'white', 'ground', 'sweet', 'dark'])
// Colour and variety words that do not change what the thing is for cooking:
// a recipe's "onion" is satisfied by a "yellow onion" on the shelf.
const VARIETY = new Set(['yellow', 'red', 'green', 'purple', 'baby', 'jumbo', 'mini', 'roma', 'russet', 'yukon', 'gold', 'vidalia', 'spanish', 'ripe', 'firm', 'regular', 'classic', 'original', 'cherry', 'grape', 'heirloom', 'beefsteak', 'navel', 'fuji', 'gala', 'honeycrisp', 'bartlett', 'hass', 'iceberg', 'romaine', 'curly', 'flat', 'wild', 'farmed', 'atlantic', 'king', 'jasmine', 'basmati', 'long-grain', 'short-grain'])

// Joining words that carry no meaning of their own.
const STOP = new Set(['and', 'or', 'of', 'with', 'for', 'the', 'a', 'an', 'in', 'on', 'to', 'at', 'from', 'plus'])

// Amount phrases that ride along on a name: "salt to taste".
const TAIL_RE = /\b(?:or\s+)?(?:more\s+)?(?:to taste|as needed|as desired|if needed|if desired|for serving|for garnish|optional)\b/g

// Direct aliases: a name and the other name it should match.
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

const phrase = (q) => q.toLowerCase().replace(/-/g, ' ')
const QUAL_MULTI = [...new Set(QUALIFIERS.map(phrase).filter(q => q.includes(' ')))]
  .sort((a, b) => b.length - a.length)
  .map(q => new RegExp(` ${q} `, 'g'))
const QUAL_SINGLE = new Set(QUALIFIERS.map(phrase).filter(q => !q.includes(' ')))

// Plural to singular, enough for pantry names: berries -> berry,
// tomatoes -> tomato, peaches -> peach, eggs -> egg. Short words and words
// ending in ss or us are left alone (gas, molasses, asparagus).
function fold(word) {
  if (word.length <= 3) return word
  if (/ies$/.test(word) && word.length > 4) return word.slice(0, -3) + 'y'
  if (/oes$/.test(word)) return word.slice(0, -2)
  if (/(?:ch|sh|x|z)es$/.test(word)) return word.slice(0, -2)
  if (/(?:ss|us)$/.test(word)) return word
  if (/s$/.test(word)) return word.slice(0, -1)
  return word
}

function clean(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(TAIL_RE, ' ')
    .replace(/[-\u2013\u2014/]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const EMPTY = Object.freeze({ core: [], marked: [], full: [], key: '' })
const cache = new Map()

// A name as token lists. `core` has every qualifier stripped; `marked` holds
// the meaningful qualifiers that were removed; `full` is core with those
// qualifiers kept in place. `key` is core joined, for alias lookups.
function tokenize(name) {
  const s = clean(name)
  if (!s) return EMPTY
  const hit = cache.get(s)
  if (hit) return hit

  const original = s.split(' ')
  let joined = ` ${s} `
  for (const re of QUAL_MULTI) {
    while (re.test(joined)) joined = joined.replace(re, ' ')
    re.lastIndex = 0
  }
  const core = []
  const marked = []
  const full = []
  for (const w of joined.trim().split(' ')) {
    if (!w || STOP.has(w)) continue
    const f = fold(w)
    if (MEANINGFUL.has(w)) { marked.push(f); full.push(f); continue }
    if (QUAL_SINGLE.has(w)) continue
    core.push(f)
    full.push(f)
  }
  // Never strip the last word: "Fresh" on its own is still a name.
  const result = core.length
    ? { core, marked, full, key: core.join(' ') }
    : (() => { const last = fold(original[original.length - 1]); return { core: [last], marked: [], full: [last], key: last } })()

  if (cache.size > 5000) cache.clear()
  cache.set(s, result)
  return result
}

const ALIAS_TOKENS = new Map()
for (const [from, to] of Object.entries(ALIASES)) {
  const a = tokenize(from)
  const b = tokenize(to)
  if (a.core.length && b.core.length && a.key !== b.key) ALIAS_TOKENS.set(a.key, b)
}

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x))
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
const subset = (a, b) => a.every(x => b.includes(x))

// 3 exact, 1 subset with the head noun agreeing, 0 otherwise.
// A qualifier that names a different thing when only one side has it.
const STRICT = new Set(['sweet'])

function compare(a, b) {
  if (!a.core.length || !b.core.length) return 0
  for (const t of STRICT) if (a.marked.includes(t) !== b.marked.includes(t)) return 0
  const retain = a.marked.length > 0 && b.marked.length > 0 && !sameSet(a.marked, b.marked)
  const x = retain ? a.full : a.core
  const y = retain ? b.full : b.core
  if (sameList(x, y)) return 3
  if (x.length >= 2 && y.length >= 2 && x[x.length - 1] === y[y.length - 1] && (subset(x, y) || subset(y, x))) return 1
  // One word against a variety of it: head noun equal, the rest plain variety words.
  const variety = (s, m) => s.length === 1 && m.length >= 2 && m[m.length - 1] === s[0] && m.slice(0, -1).every(t => VARIETY.has(t))
  if (variety(x, y) || variety(y, x)) return 1
  return 0
}

function scoreTokens(a, b) {
  const direct = compare(a, b)
  if (direct === 3) return 3
  let best = direct
  const viaAlias = (s) => (s === 3 ? 2 : s)
  const aAlias = ALIAS_TOKENS.get(a.key)
  if (aAlias) best = Math.max(best, viaAlias(compare(aAlias, b)))
  const bAlias = ALIAS_TOKENS.get(b.key)
  if (bAlias) best = Math.max(best, viaAlias(compare(a, bAlias)))
  return best
}

// The comparison tokens for a name (qualifiers stripped, plurals folded).
export function matchTokens(name) {
  return tokenize(name).core
}

// 0 (no match), 1 (subset), 2 (alias) or 3 (exact).
export function matchScore(recipeName, inventoryName) {
  return scoreTokens(tokenize(recipeName), tokenize(inventoryName))
}

export function namesMatch(recipeName, inventoryName) {
  return matchScore(recipeName, inventoryName) > 0
}

// The inventory item a recipe ingredient refers to, or null. Candidates are
// ranked by score, then stock on hand (qty > 0), then inventory order.
export function findMatch(ingredientName, inventoryItems) {
  const a = tokenize(ingredientName)
  if (!a.core.length) return null
  let best = null
  let bestScore = 0
  let bestStocked = false
  for (const item of inventoryItems ?? []) {
    const s = scoreTokens(a, tokenize(item?.name))
    if (s === 0) continue
    const stocked = Number(item.qty) > 0
    if (s > bestScore || (s === bestScore && stocked && !bestStocked)) {
      best = item
      bestScore = s
      bestStocked = stocked
    }
  }
  return best
}

// Does a recipe ingredient name match any name in a Set of inventory names?
// Used by useIngredientCoverage for bulk coverage.
export function hasMatch(ingredientName, inventoryNameSet) {
  const a = tokenize(ingredientName)
  if (!a.core.length) return false
  for (const invName of inventoryNameSet) {
    if (scoreTokens(a, tokenize(invName)) > 0) return true
  }
  return false
}

const NUM = '(?:\\d+(?:[.,]\\d+)?(?:\\/\\d+)?|\\d*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞⅐⅑⅒])'
const AMOUNT_RE = new RegExp(`^(?:${NUM}(?:[-\u2013\u2014]${NUM})?|\\d+x)$`, 'i')
const RANGE_JOIN = new Set(['-', '\u2013', '\u2014', 'to', 'x'])

// A recipe ingredient name fit for the grocery list: no parenthetical, no
// leading amount or unit word, no stray punctuation. Case is kept. Returns
// '' when nothing is left, so callers can drop the row.
export function cleanGroceryName(name) {
  const s = String(name ?? '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  const words = s.split(' ')
  const peek = (i = 0) => (words[i] ?? '').replace(/[.,;:]+$/, '')

  while (words.length && AMOUNT_RE.test(peek())) {
    words.shift()
    if (words.length > 1 && RANGE_JOIN.has(peek().toLowerCase()) && AMOUNT_RE.test(peek(1))) words.shift()
  }
  for (;;) {
    if (words.length >= 2 && normalizeUnit(`${peek()} ${peek(1)}`) === 'fl oz') { words.splice(0, 2); continue }
    if (words.length && normalizeUnit(peek())) { words.shift(); continue }
    break
  }
  if (words.length > 1 && peek().toLowerCase() === 'of') words.shift()

  return words.join(' ').replace(/^[\s,;:.]+|[\s,;:.]+$/g, '').trim()
}
