import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Tile } from '../../components/ui/Tile'
import { EmptyState } from '../../components/ui/EmptyState'
import { LOCATION_LABELS, locationTheme } from './locationTheme'

const ORDER = ['fridge', 'freezer', 'pantry', 'home_goods']

function groupByLocation(suspects) {
  const map = new Map()
  for (const s of suspects) {
    const loc = s.item.location
    if (!map.has(loc)) map.set(loc, [])
    map.get(loc).push(s)
  }
  return ORDER.filter(l => map.has(l)).map(l => [l, map.get(l)])
}

// Full-screen review: one tinted tile per location, Still good or Toss it per item.
export function FreshnessSheet({ open, suspects, onKeep, onToss, onKeepAll, onClose }) {
  const groups = groupByLocation(suspects)
  const footer = suspects.length > 0
    ? <Button variant="ghost" className="w-full" onClick={onKeepAll}>Keep all</Button>
    : <Button className="w-full bg-ink" onClick={onClose}>Close</Button>

  return (
    <Sheet open={open} size="full" onClose={onClose} title="Still have these?" footer={footer}>
      {suspects.length === 0 ? (
        <EmptyState title="All checked" hint="Nothing else looks past its usual shelf life." />
      ) : (
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-sm text-ink-2">Based on typical shelf life. Tap Still good if it is fine.</p>
          {groups.map(([loc, rows]) => {
            const theme = locationTheme(loc)
            const label = LOCATION_LABELS[loc] || loc
            return (
              <Tile key={loc} tileClass={theme.tile} inkClass={theme.ink} heading={label} count={rows.length}>
                <div className="flex flex-col gap-1.5">
                  {rows.map(({ item, ageDays, limitDays }) => (
                    <div key={item.id} className="flex flex-col gap-2 rounded-row bg-surface px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-ink">{item.name}</p>
                        <p className="text-[13px] text-ink-2">{ageDays} days in the {label.toLowerCase()}, usually {limitDays}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" className="h-10 flex-1" aria-label={`${item.name} is still good`} onClick={() => onKeep(item)}>Still good</Button>
                        <Button size="sm" variant="danger" className="h-10 flex-1" aria-label={`Toss ${item.name}`} onClick={() => onToss(item)}>Toss it</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Tile>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
