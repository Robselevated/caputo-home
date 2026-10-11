// Multi-line sibling of the Input primitive, same box styling.
const BOX = 'w-full rounded-row border border-hairline bg-surface px-4 py-3 text-base leading-snug text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink/15 focus:border-ink/30'

export function Textarea({ className = '', ...rest }) {
  return <textarea className={`${BOX} ${className}`} {...rest} />
}
