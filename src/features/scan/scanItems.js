import { TAXONOMY, DEFAULT_UNITS, UNITS } from '../../lib/constants'

const defaultUnit = (location, category) => DEFAULT_UNITS[location]?.[category]

// Scan results come back loosely shaped. Every row gets a stable key, an
// include flag and a resolved unit so both review sheets can treat them alike.
export function prepareItems(items, locationOf) {
  return items.map((item, i) => {
    const location = locationOf(item)
    return {
      ...item,
      _id: `item-${i}`,
      included: true,
      location,
      qty: item.qty || 1,
      category: item.category || 'Other',
      subcategory: item.subcategory || '',
      unit: item.unit || defaultUnit(location, item.category) || 'count',
    }
  })
}

// A new category clears the type and takes that category's usual unit.
export function withCategory(item, category) {
  return { ...item, category, subcategory: '', unit: defaultUnit(item.location, category) || item.unit }
}

// A new location starts over at its first category, as the review always has.
export function withLocation(item, location) {
  const category = Object.keys(TAXONOMY[location] || {})[0] || 'Other'
  return { ...item, location, category, subcategory: '', unit: defaultUnit(location, category) || item.unit }
}

export function unitOptions(location, current) {
  const set = new Set([...UNITS, ...Object.values(DEFAULT_UNITS[location] || {})])
  if (current) set.add(current)
  return [...set]
}

// What onConfirm receives: the item without the sheet's own bookkeeping.
export function toConfirmed({ _id, included, ...item }) {
  return item
}
