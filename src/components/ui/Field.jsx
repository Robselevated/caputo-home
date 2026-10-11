import { ChevronDown } from 'lucide-react'

const BOX = 'h-12 w-full rounded-row border border-hairline bg-surface px-4 text-base text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink/15 focus:border-ink/30'

// Label above a control. The control carries `id={htmlFor}`.
export function Field({ label, htmlFor, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</label>
      {children}
    </div>
  )
}

export function Input({ className = '', ...rest }) {
  return <input className={`${BOX} ${className}`} {...rest} />
}

export function Select({ className = '', children, ...rest }) {
  return (
    <span className="relative block">
      <select className={`${BOX} appearance-none pr-10 ${className}`} {...rest}>{children}</select>
      <ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
    </span>
  )
}
