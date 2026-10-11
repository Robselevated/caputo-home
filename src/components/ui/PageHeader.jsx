// Page title + one-line subtitle, one round action on the right.
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="font-heading text-[32px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
