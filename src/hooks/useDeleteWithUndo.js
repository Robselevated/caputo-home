import { useCallback, useRef } from 'react'
import { usePendingAction } from './usePendingAction'
import { toast } from '../components/ui/Toast'

// Optimistic delete with an undo window: the row disappears at once, a toast
// offers Undo, and the real delete only runs when the window closes (or the
// page is left). Replaces a confirm dialog without making mistakes permanent.
export function useDeleteWithUndo(deleteItem, { delayMs = 4000, message } = {}) {
  const toastIds = useRef(new Map())
  const messageRef = useRef(message)
  messageRef.current = message

  const { schedule, cancel, isPending, pendingKeys } = usePendingAction((item) => {
    const tid = toastIds.current.get(item.id)
    if (tid != null) {
      toast.dismiss(tid)
      toastIds.current.delete(item.id)
    }
    deleteItem(item.id)
  }, { delayMs })

  const requestDelete = useCallback((item) => {
    schedule(item.id, item)
    const text = messageRef.current ? messageRef.current(item) : `${item.name} removed`
    const tid = toast({
      message: text,
      durationMs: delayMs,
      action: {
        label: 'Undo',
        onClick: () => {
          cancel(item.id)
          toastIds.current.delete(item.id)
        },
      },
    })
    toastIds.current.set(item.id, tid)
  }, [schedule, cancel, delayMs])

  return { requestDelete, isHidden: isPending, hiddenIds: pendingKeys }
}
