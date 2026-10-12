// Unit families and conversions for "I made this": how much of an inventory
// row a recipe amount uses. Canonical unit names come from the shared
// ingredient parser so there is one unit table in the app.
import { normalizeUnit } from './ingredientParse'

// Grams per unit.
const WEIGHT = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 }

// Millilitres per unit (US customary).
const VOLUME = {
  ml: 1,
  l: 1000,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  'fl oz': 29.5735295625,
  cup: 236.5882365,
  pint: 473.176473,
  quart: 946.352946,
  gallon: 3785.411784,
}

const round3 = (n) => Math.round(n * 1000) / 1000

// 'weight' | 'volume' | 'count' for a known unit, null for blank or unknown.
export function unitFamily(unit) {
  const canon = normalizeUnit(unit)
  if (!canon) return null
  if (canon in WEIGHT) return 'weight'
  if (canon in VOLUME) return 'volume'
  return 'count'
}

// qty expressed in `toUnit`, or null when the pair cannot be converted: a
// missing amount, an unknown unit, two different families, or two different
// count units (a can is not a box).
export function convertQty(qty, fromUnit, toUnit) {
  const n = Number(qty)
  if (qty == null || qty === '' || !Number.isFinite(n)) return null
  const from = normalizeUnit(fromUnit)
  const to = normalizeUnit(toUnit)
  if (!from || !to) return null
  if (from === to) return n
  const family = unitFamily(from)
  if (family !== unitFamily(to)) return null
  if (family === 'weight') return round3((n * WEIGHT[from]) / WEIGHT[to])
  if (family === 'volume') return round3((n * VOLUME[from]) / VOLUME[to])
  return null
}
