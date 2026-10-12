// Shared ingredient-line parser, used by the app (typed and pasted entry) and
// by the Netlify functions (structured-data imports). No dependencies.
//
// A parsed row keeps the amount two ways: `qty_text` is what was written
// ("1-2", "1½", "to taste") and `qty` is the best number for math (the low end
// of a range, null when there is none). The unit is kept as typed (`unit_text`)
// and in canonical form (`unit`).

const UNICODE = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅐': 1 / 7, '⅑': 1 / 9, '⅒': 0.1,
}
const FRAC = Object.keys(UNICODE).join('')
const NUM = `(?:\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*[${FRAC}]|\\d+\\s*\\/\\s*\\d+|\\d+(?:\\.\\d+)?|[${FRAC}])`
const RANGE_RE = new RegExp(`^(${NUM})\\s*(?:-|–|—|to)\\s*(${NUM})(?=\\s|$)`)
const QTY_RE = new RegExp(`^(${NUM})(?=\\s|$|[A-Za-z(])`)
const MULT_RE = /^(\d+)\s*x\s+(?=\S)/i
const PINCH_RE = /^(?:an?\s+)?(pinch|dash|splash|handful|drizzle|squeeze|sprinkle|knob|few sprigs|sprig)(?:es)?\s+of\s+/i
const TASTE_RE = /,?\s*\b(to taste|as needed|or to taste|or more to taste|or as needed)\s*$/i
const FL_OZ_RE = /^(fl\.?\s*oz\.?|fluid ounces?)\b\.?\s*/i
const FRAC_ONLY = new RegExp(`^[${FRAC}]$`)

const round3 = (n) => Math.round(n * 1000) / 1000

export const COOKING_VERBS = [
  'preheat', 'heat', 'mix', 'stir', 'whisk', 'combine', 'add', 'cook', 'bake', 'roast', 'sear', 'simmer', 'boil', 'fry', 'saute', 'sauté',
  'grill', 'broil', 'pour', 'place', 'transfer', 'remove', 'season', 'serve', 'melt', 'drain', 'rinse', 'bring', 'reduce', 'let', 'rest',
  'cover', 'toss', 'fold', 'spread', 'brush', 'sprinkle', 'garnish', 'divide', 'arrange', 'blend', 'puree', 'purée', 'marinate',
  'refrigerate', 'chill', 'freeze', 'cool', 'flip', 'turn', 'set', 'return', 'meanwhile', 'once', 'when', 'while', 'using', 'repeat',
  'continue', 'taste', 'adjust', 'top', 'assemble', 'layer', 'knead', 'roll', 'shape', 'form', 'prepare', 'make', 'pat', 'line', 'grease',
  'spray', 'drizzle', 'squeeze', 'scrape', 'discard', 'strain', 'enjoy', 'in a', 'in the', 'on a', 'meanwhile,',
]
const VERB_RE = new RegExp(`^(?:${COOKING_VERBS.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i')

const PREP_RE = /^(chopped|diced|minced|sliced|thinly|thickly|finely|roughly|coarsely|freshly|fresh|softened|melted|divided|peeled|cut|grated|shredded|crushed|drained|rinsed|halved|quartered|seeded|cored|pitted|juiced|zested|beaten|lightly|room temperature|at room|plus|or|optional|for|to|about|cooked|uncooked|toasted|trimmed|deveined|skinned|cubed|julienned|crumbled|torn|warmed|cold|warm|chilled|frozen|thawed|packed|sifted|whole|ground|large|small|medium|extra|preferably|such as|like|if|more|less|additional|very|well|coarse|fine|ripe|canned|dried|dry|low-sodium|unsalted|salted|undrained|smashed|pressed|mashed|torn|cut into|from|see note|see notes|homemade|store-bought|not)\b/i

// Canonical units. Keys are lower-case aliases (trailing periods stripped).
const UNIT_ALIASES = {
  cup: 'cup', cups: 'cup', c: 'cup',
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  oz: 'oz', ounce: 'oz', ounces: 'oz', 'fl oz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  g: 'g', gram: 'g', grams: 'g', kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  qt: 'quart', quart: 'quart', quarts: 'quart', pt: 'pint', pint: 'pint', pints: 'pint', gal: 'gallon', gallon: 'gallon', gallons: 'gallon',
  can: 'can', cans: 'can', jar: 'jar', jars: 'jar', bottle: 'bottle', bottles: 'bottle', box: 'box', boxes: 'box', bag: 'bag', bags: 'bag',
  package: 'package', packages: 'package', pkg: 'package', pkgs: 'package', packet: 'package', packets: 'package',
  envelope: 'envelope', envelopes: 'envelope', stick: 'stick', sticks: 'stick', slice: 'slice', slices: 'slice',
  clove: 'clove', cloves: 'clove', head: 'head', heads: 'head', bunch: 'bunch', bunches: 'bunch', stalk: 'stalk', stalks: 'stalk',
  piece: 'piece', pieces: 'piece', sprig: 'sprig', sprigs: 'sprig', pinch: 'pinch', pinches: 'pinch', dash: 'dash', dashes: 'dash',
  handful: 'handful', handfuls: 'handful', count: 'count', ear: 'ear', ears: 'ear', fillet: 'fillet', fillets: 'fillet',
}

export const UNITS = [...new Set(Object.values(UNIT_ALIASES))]

export function normalizeUnit(word) {
  if (word == null) return null
  const raw = String(word).trim()
  if (!raw) return null
  if (raw === 'T') return 'tbsp'
  if (raw === 't') return 'tsp'
  const key = raw.toLowerCase().replace(/\.+$/, '').replace(/\.\s*/g, ' ').replace(/\s+/g, ' ')
  return UNIT_ALIASES[key] ?? null
}

// Fractions a cook writes; fifths are not among them, so 2.4 stays 2.4.
const FRACTIONS = [[0.5, '1/2'], [1 / 3, '1/3'], [2 / 3, '2/3'], [0.25, '1/4'], [0.75, '3/4'], [0.125, '1/8'], [0.375, '3/8'], [0.625, '5/8'], [0.875, '7/8'], [1 / 6, '1/6'], [5 / 6, '5/6']]

// Number to the way a cook writes it: 0.5 -> "1/2", 1.5 -> "1 1/2", 2.4 -> "2.4".
export function formatQty(n) {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return ''
  const value = Number(n)
  const whole = Math.floor(value)
  const part = value - whole
  if (part < 0.01) return String(whole)
  const hit = FRACTIONS.find(([f]) => Math.abs(f - part) < 0.01)
  if (hit) return whole ? `${whole} ${hit[1]}` : hit[1]
  return String(Math.round(value * 100) / 100)
}

function toNumber(text) {
  const s = text.replace(/\s+/g, ' ').trim()
  let m
  if ((m = s.match(/^(\d+) (\d+) ?\/ ?(\d+)$/)) && +m[3]) return round3(+m[1] + +m[2] / +m[3])
  if ((m = s.match(new RegExp(`^(\\d+) ?([${FRAC}])$`)))) return round3(+m[1] + UNICODE[m[2]])
  if ((m = s.match(/^(\d+) ?\/ ?(\d+)$/)) && +m[2]) return round3(+m[1] / +m[2])
  if (FRAC_ONLY.test(s)) return round3(UNICODE[s])
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function startsWithQty(text) {
  return MULT_RE.test(text) || RANGE_RE.test(text) || QTY_RE.test(text)
}

function cleanLine(raw) {
  let text = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return { text: '', numbered: false }
  text = text.replace(/\*\*|__/g, '').replace(/^[-•*–·▢◻☐]\s*/, '').replace(/^\[\s?[xX ]?\]\s*/, '').trim()
  const numbered = /^\d+[.)]\s+/.test(text)
  if (numbered) text = text.replace(/^\d+[.)]\s+/, '')
  text = text.replace(/\*/g, '').trim()
  return { text, numbered }
}

// One line -> { name, qty, qty_text, unit, unit_text, notes, section }
//           | { section }      a group header such as "For the sauce:"
//           | { instruction }  a cooking step that was pasted among the ingredients
//           | null             nothing on the line
export function parseIngredientLine(raw, { section = '' } = {}) {
  const { text, numbered } = cleanLine(raw)
  if (!text) return null

  // Group headers: short, end with a colon, no amount in front.
  if (/:$/.test(text) && !startsWithQty(text)) {
    const header = text.replace(/:$/, '').trim()
    if (header && header.split(' ').length <= 6) return { section: header }
  }

  // Steps that landed in the ingredient list.
  const hasQty = startsWithQty(text)
  if (VERB_RE.test(text) && (numbered || text.length > 40)) return { instruction: text }
  if (numbered && !hasQty && text.length > 25) return { instruction: text }

  let qty = null
  let qty_text = ''
  let rest = text
  let m
  if ((m = text.match(MULT_RE))) {
    qty = +m[1]; qty_text = m[1]; rest = text.slice(m[0].length)
  } else if ((m = text.match(RANGE_RE))) {
    qty = toNumber(m[1]); qty_text = m[0].replace(/\s+/g, ' ').trim(); rest = text.slice(m[0].length)
  } else if ((m = text.match(QTY_RE))) {
    qty = toNumber(m[1]); qty_text = m[1].replace(/\s+/g, ' ').trim(); rest = text.slice(m[0].length)
  } else if ((m = text.match(PINCH_RE))) {
    qty_text = m[1].toLowerCase(); rest = text.slice(m[0].length)
  }
  rest = rest.trim()

  // Parentheticals ("(15 oz)", "(optional)") become notes wherever they sit;
  // a price in parentheses ("($0.32)", Budget Bytes style) is dropped.
  const notes = []
  rest = rest.replace(/\(([^)]*)\)/g, (_, inner) => {
    const t = inner.trim().replace(/^\$[\d.,]+(?:\s*(?:each|ea\.?))?$/i, '')
    if (t) notes.push(t.replace(/,?\s*\$[\d.,]+\s*$/, '').trim() || t)
    return ' '
  }).replace(/\s+/g, ' ').trim()
  // A size glued to a container: "15oz. can", "8 oz package" -> unit can, size in notes.
  const sized = rest.match(/^(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|g|gram|grams|ml|lb|lbs|pound|pounds)\.?\s+(can|cans|jar|jars|package|packages|pkg|bag|bags|box|boxes|bottle|bottles|container|containers)\b\.?\s*/i)
  if (sized && qty != null) {
    notes.unshift(`${sized[1]} ${normalizeUnit(sized[2]) || sized[2]}`)
    rest = `${sized[3]} ${rest.slice(sized[0].length)}`.trim()
  }

  // "to taste" / "as needed" at the end is the amount when there is none.
  const tail = rest.match(TASTE_RE)
  if (tail) {
    rest = rest.slice(0, tail.index).trim()
    if (!qty_text) qty_text = tail[1].toLowerCase().replace(/^or /, '')
    else notes.push(tail[1].toLowerCase())
  }

  let unit = ''
  let unit_text = ''
  if (qty != null) {
    const flOz = rest.match(FL_OZ_RE)
    if (flOz) {
      unit = 'fl oz'; unit_text = flOz[1].replace(/\.+$/, ''); rest = rest.slice(flOz[0].length).trim()
    } else {
      const first = rest.split(' ')[0] || ''
      const canon = normalizeUnit(first)
      if (canon) {
        unit = canon; unit_text = first.replace(/\.+$/, ''); rest = rest.slice(first.length).trim()
      }
    }
    rest = rest.replace(/^of\s+/i, '')
  }

  // Split preparation notes off at the first comma that starts with a prep
  // word, or at a short trailing phrase after a multi-word name ("chicken
  // thighs, bone-in"). "boneless, skinless chicken thighs" stays whole.
  let name = rest
  const parts = rest.split(',')
  for (let i = 1; i < parts.length; i++) {
    const before = parts.slice(0, i).join(',').trim()
    const after = parts.slice(i).join(',').trim()
    const shortTail = before.split(' ').length >= 2 && after.split(' ').length <= 3
    if (after && (PREP_RE.test(after) || shortTail)) {
      name = before
      notes.push(after)
      break
    }
  }
  name = name.replace(/[,;:\s]+$/, '').replace(/^[,;:\s]+/, '').trim()
  if (!name) name = text

  return { name, qty, qty_text, unit, unit_text, notes: notes.join(', '), section }
}

const INGREDIENT_HEADER = /^(ingredients?|what you need|you will need|shopping list)\s*:?$/i
const INSTRUCTION_HEADER = /^(instructions?|directions?|method|steps?|preparation|how to make it|procedure)\s*:?$/i
const NOTES_HEADER = /^(notes?|tips?|nutrition|storage|equipment|serving suggestions?)\s*:?$/i

// A pasted block -> { ingredients: Row[], instructions: string[] }. Carries the
// current group header onto the rows under it and switches to instruction mode
// at an "Instructions" heading.
export function parseIngredientText(block) {
  const ingredients = []
  const instructions = []
  let section = ''
  let mode = 'ingredients'
  for (const raw of String(block ?? '').split(/\r?\n/)) {
    const { text } = cleanLine(raw)
    if (!text) continue
    if (INGREDIENT_HEADER.test(text)) { mode = 'ingredients'; section = ''; continue }
    if (INSTRUCTION_HEADER.test(text)) { mode = 'instructions'; continue }
    if (NOTES_HEADER.test(text)) { mode = 'notes'; continue }
    if (mode === 'notes') continue
    if (mode === 'instructions') { instructions.push(text); continue }
    const r = parseIngredientLine(raw, { section })
    if (!r) continue
    if (r.section !== undefined && r.name === undefined) { section = r.section; continue }
    if (r.instruction) { instructions.push(r.instruction); continue }
    ingredients.push(r)
  }
  return { ingredients, instructions }
}

// Rows in the shape the ingredient editor holds: amount and unit as typed.
export function parseIngredientRows(block) {
  return parseIngredientText(block).ingredients.map(r => ({ name: r.name, qty: r.qty_text, unit: r.unit_text, notes: r.notes, section: r.section }))
}
