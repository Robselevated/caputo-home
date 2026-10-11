import { ChevronDown } from 'lucide-react'

// Tinted section: heading + count, white rows inside. With `onToggle` the
// heading is a disclosure button.
export function Tile({ tileClass, inkClass, heading, count, collapsed = false, onToggle, headingProps, children, className = '' }) {
  const label = (
    <>
      <h2 className={`font-heading text-[17px] font-bold ${inkClass}`}>{heading}</h2>
      <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${inkClass}`}>
        {count}
        {onToggle && (
          <ChevronDown size={18} aria-hidden="true" className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        )}
      </span>
    </>
  )
  return (
    <section className={`flex flex-col gap-1.5 rounded-tile p-2.5 ${tileClass} ${className}`}>
      {onToggle ? (
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={onToggle}
          className="flex min-h-[36px] w-full items-center justify-between gap-2 rounded-sm2 px-1.5 pb-1 pt-0.5 text-left touch-manipulation"
          {...headingProps}
        >
          {label}
        </button>
      ) : (
        <div className="flex min-h-[36px] items-center justify-between gap-2 px-1.5 pb-1 pt-0.5" {...headingProps}>{label}</div>
      )}
      {!collapsed && children}
    </section>
  )
}
