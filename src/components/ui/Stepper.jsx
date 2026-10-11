import { Minus, Plus } from 'lucide-react'

// Quantity stepper: neutral minus, bold count, accent plus (`plusClass`).
export function Stepper({ value, name, plusClass, onMinus, onPlus, minusDisabled = false, onValueTap }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        aria-label={`Fewer ${name}`}
        disabled={minusDisabled}
        onClick={onMinus}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-control text-ink active:bg-track disabled:opacity-30"
      >
        <Minus size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {onValueTap ? (
        <button type="button" onClick={onValueTap} aria-label={`Set quantity of ${name}`} className="h-10 min-w-[28px] px-0.5 text-center text-[15px] font-bold text-ink">
          {value}
        </button>
      ) : (
        <span className="min-w-[28px] px-0.5 text-center text-[15px] font-bold text-ink">{value}</span>
      )}
      <button
        type="button"
        aria-label={`More ${name}`}
        onClick={onPlus}
        className={`flex h-10 w-10 items-center justify-center rounded-full text-white active:opacity-90 ${plusClass}`}
      >
        <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  )
}
