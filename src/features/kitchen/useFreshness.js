import { useCallback, useMemo, useRef, useState } from 'react'
import { usePendingAction } from '../../hooks/usePendingAction'
import { toast } from '../../components/ui/Toast'
import { findSuspects } from './shelfLife'

export const FRESHNESS_DISMISSED_KEY = 'freshness:dismissed'
const TOSS_UNDO_MS = 4000

export function localDayKey(t = Date.now()) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const readDismissed = () => { try { return localStorage.getItem(FRESHNESS_DISMISSED_KEY) } catch { return null } }

export function namesLine(suspects, max = 3) {
  const names = suspects.slice(0, max).map(s => s.item.name)
  const extra = suspects.length - names.length
  if (extra > 0) return `${names.join(', ')} and ${extra} more`
  if (names.length <= 1) return names[0] || ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// Items past their usual shelf life across the whole kitchen, plus the
// answers. Toss is deferred behind an Undo toast so an undo never raises the
// quantity (which would reset the stock clock in the database).
export function useFreshness({ allItems, updateItem, updateQty, userId }) {
  const [dismissedDay, setDismissedDay] = useState(readDismissed)
  const [open, setOpen] = useState(false)
  const toastIds = useRef(new Map())
  const fns = useRef({})
  fns.current = { updateItem, updateQty, userId }

  const { schedule, cancel, pendingKeys } = usePendingAction((item) => {
    const tid = toastIds.current.get(item.id)
    if (tid != null) { toast.dismiss(tid); toastIds.current.delete(item.id) }
    fns.current.updateQty(item.id, 0, fns.current.userId)
  }, { delayMs: TOSS_UNDO_MS })

  // The new columns arrive with the SQL; until then there is no clock to trust.
  const ready = allItems.some(i => 'checked_at' in i)
  const suspects = useMemo(
    () => (ready ? findSuspects(allItems.filter(i => !pendingKeys.has(i.id))) : []),
    [ready, allItems, pendingKeys]
  )

  const dismiss = useCallback(() => {
    const day = localDayKey()
    try { localStorage.setItem(FRESHNESS_DISMISSED_KEY, day) } catch { /* storage unavailable */ }
    setDismissedDay(day)
  }, [])

  const keep = useCallback((item) => {
    fns.current.updateItem(item.id, { checked_at: new Date().toISOString() }, fns.current.userId)
  }, [])

  const toss = useCallback((item) => {
    schedule(item.id, item)
    const tid = toast({
      message: `${item.name} marked out`,
      durationMs: TOSS_UNDO_MS,
      action: { label: 'Undo', onClick: () => { cancel(item.id); toastIds.current.delete(item.id) } },
    })
    toastIds.current.set(item.id, tid)
  }, [schedule, cancel])

  const keepAll = useCallback(() => { for (const s of suspects) keep(s.item) }, [suspects, keep])

  return {
    ready,
    suspects,
    count: suspects.length,
    namesLine: namesLine(suspects),
    dismissedToday: dismissedDay === localDayKey(),
    dismiss,
    keep,
    toss,
    keepAll,
    open,
    setOpen,
  }
}
