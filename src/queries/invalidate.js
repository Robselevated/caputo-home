// Leading + trailing debounce per query key: the first call invalidates at
// once (snappy), a burst within the window collapses into ONE trailing call
// (bulk check-offs, a recipe's ingredients re-inserted row by row, ...).
const timers = new Map()

export function invalidateDebounced(qc, queryKey, delayMs = 500) {
  const k = JSON.stringify(queryKey)
  const entry = timers.get(k)
  if (entry) {
    entry.pending = true
    return
  }
  qc.invalidateQueries({ queryKey })
  const rec = { pending: false, timer: null }
  rec.timer = setTimeout(() => {
    timers.delete(k)
    if (rec.pending) qc.invalidateQueries({ queryKey })
  }, delayMs)
  timers.set(k, rec)
}
