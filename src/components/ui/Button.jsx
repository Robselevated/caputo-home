// Text button. primary expects a bg class from the caller (the section accent)
// and falls back to ink so it is never invisible.
const VARIANTS = {
  primary: 'text-white',
  secondary: 'bg-control text-ink',
  ghost: 'bg-transparent text-ink-2',
  danger: 'bg-danger-tile text-danger-ink',
}

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', children, ...rest }) {
  const bg = variant === 'primary' && !/\bbg-/.test(className) ? 'bg-ink' : ''
  const height = size === 'sm' ? 'h-9 px-3.5 text-sm' : 'h-11 px-[18px] text-[15px]'
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-bar font-semibold transition-[transform,opacity] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 ${height} ${VARIANTS[variant]} ${bg} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
