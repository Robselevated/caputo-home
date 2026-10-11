import { EllipsisVertical, ShoppingCart } from 'lucide-react'
import { Stepper } from '../../components/ui/Stepper'
import { IconButton } from '../../components/ui/IconButton'

export function rowDetail(item) {
  return [item.unit, item.notes].filter(Boolean).join(', ')
}

// One white row inside a category tile. At zero the stepper gives way to Buy
// and Remove; the name opens the edit sheet either way.
export function InventoryItemRow({ item, theme, onQty, onOpen, onBuy, onRemove }) {
  const out = item.qty === 0
  const detail = rowDetail(item)
  return (
    <div className="flex items-center gap-1.5 rounded-row bg-surface py-2 pl-3 pr-1">
      <button type="button" aria-label={`Edit ${item.name}`} onClick={() => onOpen(item)} className="flex min-w-0 flex-1 flex-col items-start gap-px py-1 text-left">
        <span className="w-full truncate text-base font-semibold text-ink">{item.name}</span>
        {out ? (
          <span className="text-[13px] font-semibold text-danger-ink">Out</span>
        ) : (
          detail && <span className="w-full truncate text-[13px] text-ink-2">{detail}</span>
        )}
      </button>
      {out ? (
        <div className="flex shrink-0 items-center gap-1.5 pr-1">
          <button type="button" aria-label={`Add ${item.name} to grocery list`} onClick={() => onBuy(item)} className="flex h-10 items-center gap-1.5 rounded-sm2 bg-store-pilgrims-tile px-3 text-sm font-semibold text-store-pilgrims-ink active:opacity-80">
            <ShoppingCart size={18} aria-hidden="true" />Buy
          </button>
          <button type="button" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item)} className="h-10 rounded-sm2 bg-danger-tile px-3 text-sm font-semibold text-danger-ink active:opacity-80">
            Remove
          </button>
        </div>
      ) : (
        <>
          <Stepper value={item.qty} name={item.name} plusClass={theme.accentBg} onMinus={() => onQty(item, -1)} onPlus={() => onQty(item, 1)} />
          <IconButton label={`More options for ${item.name}`} onClick={() => onOpen(item)}>
            <EllipsisVertical size={20} aria-hidden="true" />
          </IconButton>
        </>
      )}
    </div>
  )
}
