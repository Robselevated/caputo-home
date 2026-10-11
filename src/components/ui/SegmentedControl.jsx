// Fridge | Freezer | Pantry switcher. `options[].activeClass` colors the
// selected label (the location accent); `activeClass` is the fallback.
export function SegmentedControl({ label, options, value, onChange, activeClass = 'text-ink' }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid gap-1 rounded-bar bg-track p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={`h-10 rounded-sm2 text-[15px] transition-colors ${
              selected ? `bg-surface font-bold shadow-lift ${o.activeClass ?? activeClass}` : 'font-semibold text-ink-2'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
