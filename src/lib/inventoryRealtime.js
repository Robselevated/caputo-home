// Pure helpers for applying Supabase realtime payloads to a per-location
// inventory list. Kept free of React/supabase so they can be unit tested and
// reused by the Phase 2 query cache.

const collator = new Intl.Collator('en', { sensitivity: 'base' })

function cmpNullsLast(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return collator.compare(String(a), String(b))
}

// Same ordering the list query asks the server for: category, subcategory, name.
export function sortInventory(rows) {
  return [...rows].sort((a, b) =>
    cmpNullsLast(a.category, b.category) ||
    cmpNullsLast(a.subcategory, b.subcategory) ||
    cmpNullsLast(a.name, b.name)
  )
}

// Returns the next items array for `location` given a postgres_changes payload.
// DELETE keys on old.id ONLY: with the default REPLICA IDENTITY the old record
// carries nothing else, which is why the previous location check dropped every
// delete coming from the other phone.
export function applyInventoryChange(items, payload, location) {
  const eventType = payload?.eventType
  const newRow = payload?.new || {}

  if (eventType === 'DELETE') {
    const id = payload?.old?.id
    if (!id || !items.some(i => i.id === id)) return items
    return items.filter(i => i.id !== id)
  }

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    if (!newRow.id) return items
    const exists = items.some(i => i.id === newRow.id)
    if (newRow.location !== location) {
      // Moved out of (or never belonged to) this location.
      return exists ? items.filter(i => i.id !== newRow.id) : items
    }
    const merged = exists
      ? items.map(i => (i.id === newRow.id ? { ...i, ...newRow } : i))
      : [...items, newRow]
    return sortInventory(merged)
  }

  return items
}
