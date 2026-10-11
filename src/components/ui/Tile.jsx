import { ChevronDown } from 'lucide-react'

// Tinted section: heading + count, white rows inside. With `onToggle` the
// heading holds a disclosure button (a real h2 for the headings rotor);
// `headingProps` lands on that button so it can double as a drag activator.
export function Tile({ tileClass, inkClass, heading, count, collapsed = false, onToggle, headingProps, children, className = '' }) {
  return (
    <section className={`flex flex-col gap-1.5 rounded-tile p-2.5 ${tileClass} ${className}`}>
      <div className="flex min-h-[36px] items-center justify-between gap-2 pb-1 pt-0.5">
        <h2 className={`min-w-0 flex-1 font-heading text-[17px] font-bold ${inkClass}`}>
          {onToggle ? (
            <button
              type="button"
              aria-expanded={!collapsed}
              onClick={onToggle}
              className="flex min-h-[36px] w-full items-center gap-1.5 rounded-sm2 px-1.5 text-left touch-manipulation"
              {...headingProps}
            >
              <span className="truncate">{heading}</span>
              <ChevronDown size={18} aria-hidden="true" className={`shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="block truncate px-1.5">{heading}</span>
          )}
        </h2>
        <span className={`flex shrink-0 items-center gap-1.5 pr-1.5 text-[13px] font-semibold ${inkClass}`}>{count}</span>
      </div>
      {!collapsed && children}
    </section>
  )
}
