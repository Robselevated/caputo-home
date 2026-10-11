import { useMemo, useState } from 'react'
import { History, Plus } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { storeTheme } from './storeTheme'

const DAYS = 14

function dayKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDayLabel(key) {
  const date = new Date(`${key}T00:00:00`)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - date) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Chips of what was checked off in the last two weeks (one per name, newest
// first); tap to put it back on the list. History opens the full by-day view.
export function RecentlyBought({ items, onAddBack }) {
  const [showHistory, setShowHistory] = useState(false)

  const { chips, byDay } = useMemo(() => {
    const cutoff = Date.now() - DAYS * 86400000
    const recent = items
      .filter(i => new Date(i.bought_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.bought_at) - new Date(a.bought_at))
    const seen = new Set()
    const chips = []
    for (const i of recent) {
      const k = i.name.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      chips.push(i)
      if (chips.length === 8) break
    }
    const days = new Map()
    for (const i of recent) {
      const k = dayKey(i.bought_at)
      if (!days.has(k)) days.set(k, new Map())
      const byName = days.get(k)
      const nk = i.name.toLowerCase()
      const prev = byName.get(nk)
      if (prev) prev.totalQty += i.qty || 1
      else byName.set(nk, { ...i, totalQty: i.qty || 1 })
    }
    return { chips, byDay: [...days.entries()].map(([k, m]) => [k, [...m.values()]]) }
  }, [items])

  if (chips.length === 0) return null

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-heading text-[17px] font-bold text-ink">Recently bought</h2>
        <button type="button" onClick={() => setShowHistory(true)} className="flex h-10 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-accent-grocery">
          <History size={16} aria-hidden="true" />History
        </button>
      </div>
      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 no-scrollbar">
        {chips.map(i => (
          <button
            key={i.id}
            type="button"
            onClick={() => onAddBack(i)}
            aria-label={`Add ${i.name} back to the list`}
            className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-hairline bg-surface pl-2.5 pr-3.5 text-[13px] font-semibold text-ink active:bg-control"
          >
            <Plus size={16} aria-hidden="true" className="text-ink-3" />{i.name}
          </button>
        ))}
      </div>

      <Sheet open={showHistory} onClose={() => setShowHistory(false)} title="Recently bought">
        <div className="flex flex-col gap-4 pb-2">
          {byDay.map(([day, rows]) => (
            <div key={day} className="flex flex-col gap-1.5">
              <h3 className="px-1 text-[13px] font-semibold text-ink-2">{formatDayLabel(day)}</h3>
              {rows.map(i => {
                const t = storeTheme(i.store)
                return (
                  <div key={i.id} className="flex items-center gap-3 rounded-row bg-control py-2 pl-3.5 pr-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-ink">
                        {i.name}{i.totalQty > 1 && <span className="ml-1.5 text-[13px] font-medium text-ink-2">x{i.totalQty}</span>}
                      </p>
                      {i.store && <p className={`text-[13px] font-semibold ${t.ink}`}>{i.store}</p>}
                    </div>
                    <Button size="sm" variant="secondary" className="bg-surface" onClick={() => onAddBack(i)}>Add back</Button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </Sheet>
    </section>
  )
}
