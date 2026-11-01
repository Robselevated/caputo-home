import { EllipsisVertical } from 'lucide-react'
import { Stepper } from '../../components/ui/Stepper'
import { IconButton } from '../../components/ui/IconButton'

export function rowDetail(item) {
  return [item.unit, item.notes].filter(Boolean).join(', ')
}

// One white row inside a category tile. Only stocked items get here: the
// page removes a row when its stepper reaches zero. The name opens the edit sheet.
export function InventoryItemRow({ item, theme, onQty, onOpen }) {
  const detail = rowDetail(item)
  return (
    <div className="flex items-center gap-1.5 rounded-row bg-surface py-2 pl-3 pr-1">
      <button type="button" aria-label={`Edit ${item.name}`} onClick={() => onOpen(item)} className="flex min-w-0 flex-1 flex-col items-start gap-px py-1 text-left">
        <span className="w-full truncate text-base font-semibold text-ink">{item.name}</span>
        {detail && <span className="w-full truncate text-[13px] text-ink-2">{detail}</span>}
      </button>
      <Stepper value={item.qty} name={item.name} plusClass={theme.accentBg} onMinus={() => onQty(item, -1)} onPlus={() => onQty(item, 1)} onValueTap={() => onOpen(item)} />
      <IconButton label={`More options for ${item.name}`} onClick={() => onOpen(item)}>
        <EllipsisVertical size={20} aria-hidden="true" />
      </IconButton>
    </div>
  )
}
