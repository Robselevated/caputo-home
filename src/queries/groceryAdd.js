import { queueWrite } from '../lib/db'
import { toastNotQueued } from '../lib/offlineToasts'
import { upsertById } from '../lib/realtimeCache'
import { keys } from './keys'
import { toError } from './fetchers'

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false
const storeOf = (row) => row.store || 'Grocery Store'

// Give new rows the next sort_order in their store, after everything already
// on the list, so they land at the bottom of their group like a typed item
// instead of at the top with the default 0.
export function placeAtEnd(rows, current = []) {
  const max = new Map()
  for (const r of current) max.set(storeOf(r), Math.max(max.get(storeOf(r)) ?? 0, r.sort_order ?? 0))
  return rows.map((r) => {
    const next = (max.get(storeOf(r)) ?? 0) + 1
    max.set(storeOf(r), next)
    return { ...r, sort_order: next }
  })
}

// Add rows to the grocery list from anywhere outside the Grocery page (kitchen,
// recently bought, recipes): optimistic on the shared cache, queued when
// offline, rolled back on failure. Resolves { error, queued, rows }.
export async function addGroceryRows(qc, client, householdId, rows) {
  if (!householdId) return { error: 'No household' }
  if (!rows.length) return { error: null, rows: [] }
  const key = keys.grocery(householdId)
  await qc.cancelQueries({ queryKey: key })
  const placed = placeAtEnd(rows.map(r => ({ ...r, id: r.id ?? crypto.randomUUID() })), qc.getQueryData(key) ?? [])
  const now = new Date().toISOString()
  qc.setQueryData(key, prev => (prev ? [...prev, ...placed.map(r => ({ ...r, created_at: now }))] : prev))

  if (isOffline()) {
    const results = await Promise.all(placed.map(data => queueWrite({ type: 'insert', data })))
    const queued = results.every(Boolean)
    if (!queued) toastNotQueued()
    return { error: null, queued, rows: placed }
  }

  const ids = new Set(placed.map(r => r.id))
  try {
    const { data, error } = await client.from('grocery_items').insert(placed).select()
    if (error) throw toError(error)
    if (data?.length) qc.setQueryData(key, prev => (prev ? data.reduce((acc, row) => upsertById(acc, row), prev) : prev))
    return { error: null, rows: placed }
  } catch (error) {
    qc.setQueryData(key, prev => (prev ? prev.filter(r => !ids.has(r.id)) : prev))
    return { error }
  }
}
