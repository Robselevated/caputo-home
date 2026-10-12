import { Button } from '../../components/ui/Button'

// Once-a-day nudge under the Kitchen title.
export function FreshnessCard({ count, namesLine, theme, onReview, onDismiss }) {
  return (
    <section aria-label="Freshness check" className={`flex flex-col gap-3 rounded-tile p-4 ${theme.tile}`}>
      <div className="flex flex-col gap-0.5">
        <p className={`font-heading text-[17px] font-bold ${theme.ink}`}>
          {count} {count === 1 ? 'thing' : 'things'} might have gone off
        </p>
        <p className="text-sm text-ink-2">{namesLine}</p>
      </div>
      <div className="flex gap-2">
        <Button className={theme.accentBg} onClick={onReview}>Review</Button>
        <Button variant="ghost" onClick={onDismiss}>Not now</Button>
      </div>
    </section>
  )
}
