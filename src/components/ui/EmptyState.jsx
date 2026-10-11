export function EmptyState({ icon: Icon, title, hint, className = '' }) {
  return (
    <div className={`flex flex-col items-center px-6 py-14 text-center ${className}`}>
      {Icon && <Icon size={40} strokeWidth={1.6} aria-hidden="true" className="mb-3 text-ink-3" />}
      <p className="font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-2">{hint}</p>}
    </div>
  )
}
