import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

// Bottom sheet: portal, slide-up, backdrop and Escape close it, body scroll is
// locked while open, and focus goes back to whatever opened it. onClose is read
// through a ref so a parent re-render never re-runs the focus dance mid-typing.
export function Sheet({ open, onClose, title, children, footer }) {
  const titleId = useId()
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current?.() }
    document.addEventListener('keydown', onKey)
    const panel = panelRef.current
    const first = panel?.querySelector('input, select, textarea, button:not([data-sheet-close])')
    ;(first ?? panel)?.focus?.()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div
        data-testid="sheet-backdrop"
        className="absolute inset-0 bg-ink/40 animate-fade-in"
        onClick={() => onCloseRef.current?.()}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md max-h-[88dvh] flex flex-col bg-surface rounded-t-[24px] shadow-sheet animate-sheet-up outline-none pb-[max(env(safe-area-inset-bottom,0px),1rem)]"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 id={titleId} className="font-heading text-xl font-bold text-ink">{title}</h2>
          <IconButton label="Close" onClick={() => onCloseRef.current?.()} data-sheet-close="true">
            <X size={22} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-2">{children}</div>
        {footer && <div className="px-5 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
