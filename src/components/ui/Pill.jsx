// Filter chip. The active chip is ink-filled unless the caller passes its own
// active classes (store pills use their tile tint).
export function Pill({ active = false, activeClass = 'bg-ink text-white', inactiveClass = 'bg-surface border border-hairline text-ink-2', className = '', children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`h-[34px] shrink-0 rounded-full px-3 text-[13px] font-semibold transition-colors ${active ? activeClass : inactiveClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
