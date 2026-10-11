import { CheckCircle } from '../../components/ui/CheckCircle'
import { Stepper } from '../../components/ui/Stepper'

export function itemDetail(item) {
  const qty = item.qty ?? 1
  const amount = item.unit ? `${qty} ${item.unit}` : (qty > 1 ? String(qty) : '')
  return [amount, item.notes].filter(Boolean).join(', ')
}

// One white row inside a store tile. The name is the drag activator (press and
// hold) and a tap on it opens the edit sheet; `sortable` carries the dnd-kit
// bindings or is null when the row cannot move.
export function GroceryItemRow({ item, theme, onCheck, onQty, onOpen, sortable }) {
  const checked = !!item.checked
  const detail = itemDetail(item)
  return (
    <div
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      className={`flex items-center gap-2.5 rounded-row py-2 pl-3 pr-2 ${checked ? 'bg-surface/55' : 'bg-surface'}`}
    >
      <CheckCircle
        checked={checked}
        label={checked ? `Undo check off ${item.name}` : `Check off ${item.name}`}
        ringClass={theme.ring}
        fillClass={theme.accentBg}
        onClick={() => onCheck(item)}
      />
      <button
        type="button"
        aria-label={`Edit ${item.name}`}
        onClick={() => onOpen(item)}
        {...(sortable?.listeners ?? {})}
        className="flex min-w-0 flex-1 flex-col items-start gap-px py-1 text-left touch-manipulation"
      >
        <span className={`w-full truncate text-base font-semibold ${checked ? 'text-ink-2 line-through' : 'text-ink'}`}>{item.name}</span>
        {detail && <span className={`w-full truncate text-[13px] text-ink-2`}>{detail}</span>}
      </button>
      {!checked && (
        <Stepper
          value={item.qty ?? 1}
          name={item.name}
          plusClass={theme.accentBg}
          minusDisabled={(item.qty ?? 1) <= 1}
          onMinus={() => onQty(item, -1)}
          onPlus={() => onQty(item, 1)}
        />
      )}
    </div>
  )
}
