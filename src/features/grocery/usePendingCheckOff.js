import { useCallback, useRef } from 'react'
import { usePendingAction } from '../../hooks/usePendingAction'
import { toast } from '../../components/ui/Toast'

export const CHECK_OFF_DELAY_MS = 3000

// Check-off with an undo window: the row shows as checked at once, a toast
// offers Undo, and the real check-off (the RPC that moves the item to the
// kitchen) runs when the window closes or the page is left. Tapping the
// checked row again also undoes. Rows that were already checked on the server
// (legacy data) are unchecked for real instead.
export function usePendingCheckOff({ checkItem, uncheckItem, markChecked, markUnchecked, userId, onCheck, delayMs = CHECK_OFF_DELAY_MS }) {
  const fns = useRef({})
  fns.current = { checkItem, uncheckItem, markChecked, markUnchecked, userId, onCheck }
  const toastIds = useRef(new Map())

  const dismissToast = (id) => {
    const tid = toastIds.current.get(id)
    if (tid != null) {
      toast.dismiss(tid)
      toastIds.current.delete(id)
    }
  }

  const pending = usePendingAction((entry) => {
    dismissToast(entry.item.id)
    fns.current.checkItem(entry.item, entry.userId)
  }, { delayMs })

  const undo = useCallback((item) => {
    pending.cancel(item.id)
    dismissToast(item.id)
    fns.current.markUnchecked(item.id)
  }, [pending])

  const check = useCallback((item) => {
    const { markChecked: mark, uncheckItem: uncheck, userId: uid, onCheck: after } = fns.current
    if (item.checked) {
      if (pending.isPending(item.id)) undo(item)
      else uncheck(item, uid)
      return
    }
    mark(item.id)
    pending.schedule(item.id, { item, userId: uid })
    const tid = toast({
      message: `${item.name} checked off`,
      durationMs: delayMs,
      action: { label: 'Undo', onClick: () => undo(item) },
    })
    toastIds.current.set(item.id, tid)
    after?.(item)
  }, [pending, undo, delayMs])

  return { check, undo, isPending: pending.isPending }
}
