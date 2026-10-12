// Typical shelf life in days, by item keyword first and category second.
// null means never flag (condiments, pantry staples, home goods).
export const DAY_MS = 86400000

// Most specific phrases first; first match wins. Fridge and pantry only.
const KEYWORDS = [
  [['oat milk', 'almond milk', 'soy milk'], 10],
  [['half and half', 'half & half'], 7],
  [['heavy cream', 'whipping cream'], 10],
  [['cottage cheese'], 10],
  [['sour cream'], 14],
  [['cream cheese'], 14],
  [['shredded cheese', 'shredded cheddar', 'shredded mozzarella'], 14],
  [['block cheese'], 30],
  [['buttermilk'], 10],
  [['milk'], 7],
  [['yogurt', 'yoghurt'], 14],
  [['butter'], 60],
  [['egg'], 28],
  [['berries', 'berry', 'strawberry', 'strawberries', 'blueberry', 'blueberries', 'raspberry', 'raspberries'], 4],
  [['spinach', 'lettuce', 'greens', 'arugula', 'kale', 'romaine', 'spring mix'], 6],
  [['cilantro', 'parsley', 'basil', 'herbs', 'dill', 'mint'], 7],
  [['guacamole'], 3],
  [['avocado'], 4],
  [['banana'], 5],
  [['tomato'], 7],
  [['cucumber'], 7],
  [['mushroom'], 7],
  [['bell pepper'], 10],
  [['broccoli', 'cauliflower', 'zucchini'], 7],
  [['celery'], 14],
  [['carrot'], 21],
  [['apple'], 21],
  [['lemon', 'lime', 'orange'], 21],
  [['grape'], 7],
  [['melon', 'watermelon', 'cantaloupe'], 7],
  [['ground beef', 'ground turkey', 'ground pork', 'ground chicken'], 2],
  [['raw chicken', 'chicken breast', 'chicken thigh', 'chicken thighs'], 2],
  [['raw fish', 'salmon', 'shrimp', 'tilapia', 'cod'], 2],
  [['fresh sausage'], 3],
  [['turkey breast', 'deli', 'ham', 'salami', 'prosciutto', 'lunch meat'], 5],
  [['bacon'], 7],
  [['hot dog'], 7],
  [['tofu'], 7],
  [['hummus'], 7],
  [['salsa'], 14],
  [['leftover', 'cooked'], 4],
  [['tortilla'], 14],
  [['bread', 'bagel', 'buns', 'rolls'], 6],
  [['juice'], 10],
  [['broth', 'stock'], 5],
]

const CATEGORY = {
  fridge: { 'Fresh Produce': 7, Dairy: 10, 'Deli Meat': 5, Bacon: 7, Bread: 6, 'Broth/Stock': 5, Beverages: 14 },
  freezer: { Chicken: 180, Beef: 180, Turkey: 180, Pork: 120, 'Ground Meat': 120, Fish: 90, Seafood: 90, 'Frozen Produce': 240, 'Frozen Meals': 90, Other: 180 },
  pantry: { Bread: 6 },
}

const norm = (s) => String(s || '').toLowerCase().replace(/[-_/.]+/g, ' ').replace(/\s+/g, ' ').trim()
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const RULES = KEYWORDS.map(([words, days]) => [new RegExp(`\\b(?:${words.map(esc).join('|')})(?:e?s)?\\b`), days])

export function shelfLifeDays(item) {
  if (!item) return null
  const loc = item.location
  const name = norm(item.name)
  if (loc === 'fridge') {
    for (const [re, days] of RULES) if (re.test(name)) return days
  } else if (loc === 'pantry') {
    // Pantry goods are shelf stable (canned milk, dried herbs); only bread goes off.
    if (/\btortillas?\b/.test(name)) return 14
    if (/\b(bread|bagels?|buns?|rolls?)\b/.test(name)) return 6
  }
  return CATEGORY[loc]?.[item.category] ?? null
}

const ts = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? t : 0 }

export function freshnessOf(item, now = Date.now()) {
  const limitDays = shelfLifeDays(item)
  const since = Math.max(ts(item.stocked_at ?? item.created_at), ts(item.checked_at))
  const ageDays = since ? Math.floor((now - since) / DAY_MS) : 0
  return { limitDays, ageDays, overdueDays: limitDays == null ? null : ageDays - limitDays, since }
}

export function findSuspects(items, now = Date.now()) {
  const out = []
  for (const item of items || []) {
    if (!(Number(item.qty) > 0)) continue
    const f = freshnessOf(item, now)
    if (f.limitDays == null || f.ageDays <= f.limitDays) continue
    out.push({ item, limitDays: f.limitDays, ageDays: f.ageDays })
  }
  return out.sort((a, b) => (b.ageDays - b.limitDays) - (a.ageDays - a.limitDays) || String(a.item.name).localeCompare(String(b.item.name)))
}
