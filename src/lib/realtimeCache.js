// Pure helpers for patching a cached list (a TanStack Query array) from a
// Supabase realtime payload or from our own optimistic/server rows.
// No React, no supabase: unit tested and shared by every table.

// Fields the client owns during an undo window. A realtime echo of the server
// row must not clobber them (the server never sets `checked`; check-off deletes).
export const CLIENT_FIELDS = ['checked', 'checked_at']

export function upsertById(rows, row, { preserve = [] } = {}) {
  if (!row || row.id == null) return rows
  const list = rows ?? []
  const idx = list.findIndex(r => r.id === row.id)
  if (idx === -1) return [...list, row]
  const old = list[idx]
  const merged = { ...old, ...row }
  for (const key of preserve) {
    if (key in old) merged[key] = old[key]
  }
  const next = list.slice()
  next[idx] = merged
  return next
}

export function removeById(rows, id) {
  if (!rows || id == null) return rows
  if (!rows.some(r => r.id === id)) return rows
  return rows.filter(r => r.id !== id)
}

// Apply one postgres_changes payload. DELETE keys on old.id only (with the
// default REPLICA IDENTITY that is all the payload carries). `filter` scopes a
// cache to a subset (e.g. one location): a row that stops matching is removed,
// a row that never matched is ignored. `sort` re-sorts after INSERT/UPDATE.
export function applyChange(rows, payload, { preserve = [], filter = null, sort = null } = {}) {
  const type = payload?.eventType
  if (type === 'DELETE') return removeById(rows, payload?.old?.id)
  if (type === 'INSERT' || type === 'UPDATE') {
    const row = payload?.new
    if (!row || row.id == null) return rows
    if (filter && !filter(row)) return removeById(rows, row.id)
    const next = upsertById(rows ?? [], row, { preserve })
    return sort ? sort(next) : next
  }
  return rows
}
