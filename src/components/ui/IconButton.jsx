// Round icon-only button. `label` is required: it is the accessible name.
// Variants: plain (transparent), control (neutral fill), outline (white with a
// hairline), fill (caller passes the bg class; icon is white).
const VARIANTS = {
  plain: 'bg-transparent text-ink-3 active:bg-control',
  control: 'bg-control text-ink active:bg-track',
  outline: 'bg-surface border border-hairline text-ink active:bg-control',
  fill: 'text-white active:opacity-90',
}

export function IconButton({ label, variant = 'plain', size = 40, className = '', type = 'button', children, ...rest }) {
  return (
    <button
      type={type}
      aria-label={label}
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,opacity,transform] active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
