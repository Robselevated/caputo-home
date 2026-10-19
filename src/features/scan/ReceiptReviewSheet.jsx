import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Tile } from '../../components/ui/Tile'
import { CheckCircle } from '../../components/ui/CheckCircle'
import { Field, Select } from '../../components/ui/Field'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { keys, STALE } from '../../queries/keys'
import { fetchGroceryItems } from '../../queries/fetchers'
import { LOCATIONS, LOCATION_LABELS, locationTheme } from '../kitchen/locationTheme'
import { ScanItemRow } from './ScanItemRow'
import { prepareItems, toConfirmed, withLocation } from './scanItems'

const EMPTY = []
// The removals tile speaks in the grocery list's colors.
const GROCERY = { tile: 'bg-store-pilgrims-tile', ink: 'text-store-pilgrims-ink', ring: 'border-accent-grocery', fill: 'bg-accent-grocery' }
const norm = (name) => name.trim().toLowerCase()
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const locationOptions = (current) => [...new Set([...LOCATIONS, current])]

function ListRow({ item, off, onToggle }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-row py-2 pl-3 pr-3 ${off ? 'bg-surface' : 'bg-surface/55'}`}>
      <CheckCircle checked={off} label={`Take ${item.name} off the list`} ringClass={GROCERY.ring} fillClass={GROCERY.fill} onClick={onToggle} />
      <div className="flex min-w-0 flex-1 flex-col gap-px py-1">
        <span className={`w-full truncate text-base font-semibold ${off ? 'text-ink' : 'text-ink-2'}`}>{item.name}</span>
        <span className="text-[13px] text-ink-2">{off ? 'Coming off the list' : 'Staying on the list'}</span>
      </div>
    </div>
  )
}

// Review of a receipt scan: what goes into the kitchen (per location) and
// which grocery rows come off the list because they were bought. Same props
// GroceryPage has always passed.
export default function ReceiptReview({ items, onConfirm, onCancel, householdId }) {
  const [rows, setRows] = useState(() => prepareItems(items, (item) => item.location || 'pantry'))
  const [expandedId, setExpandedId] = useState(null)
  const [kept, setKept] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [failedNames, setFailedNames] = useState([])

  // Same cache entry the Grocery page reads, so this is free when it is warm.
  const { data: grocery = EMPTY } = useQuery({
    queryKey: keys.grocery(householdId),
    queryFn: () => fetchGroceryItems(supabase, householdId),
    enabled: !!householdId,
    staleTime: STALE.grocery,
  })

  const patch = (id, changes) => setRows(prev => prev.map(r => (r._id === id ? { ...r, ...changes } : r)))
  const toggleKept = (id) => setKept(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const included = rows.filter(r => r.included)
  const wanted = new Set(included.map(r => norm(r.name)))
  const matches = grocery.filter(g => wanted.has(norm(g.name)))
  const removing = matches.filter(g => !kept.has(g.id))
  const groups = [...new Set([...LOCATIONS, ...rows.map(r => r.location)])]
    .map(loc => [loc, rows.filter(r => r.location === loc)])
    .filter(([, locRows]) => locRows.length > 0)

  const confirm = async () => {
    setSaving(true)
    setFailedNames([])
    try {
      const byLocation = new Map()
      for (const row of included) {
        const loc = row.location || 'pantry'
        if (!byLocation.has(loc)) byLocation.set(loc, [])
        byLocation.get(loc).push([row, toConfirmed(row)])
      }
      const savedNames = new Set()
      const failedIds = new Set()
      for (const [loc, pairs] of byLocation) {
        let result
        try {
          result = await onConfirm(pairs.map(([, c]) => c), loc, { close: false })
        } catch {
          result = { saved: [], failed: pairs.map(([, c]) => c) }
        }
        // An onConfirm that reports nothing is treated as all saved.
        const failed = result?.failed ?? []
        for (const [row, c] of pairs) {
          if (failed.includes(c)) failedIds.add(row._id)
          else savedNames.add(norm(row.name))
        }
      }

      // Only what actually reached the kitchen comes off the list. Re-read the
      // list rather than trusting the cache, so a row the other phone added
      // mid-review still comes off. `kept` is what was unchecked.
      if (savedNames.size > 0 && householdId) {
        const { data } = await supabase.from('grocery_items').select('id, name').eq('household_id', householdId)
        const ids = (data ?? []).filter(g => savedNames.has(norm(g.name)) && !kept.has(g.id)).map(g => g.id)
        if (ids.length > 0) {
          await supabase.from('grocery_items').delete().in('id', ids)
          queryClient.invalidateQueries({ queryKey: keys.grocery(householdId) })
        }
      }

      if (failedIds.size === 0) {
        onCancel()
        return
      }
      // Keep the sheet open with just the failures so Add retries them.
      setFailedNames(rows.filter(r => failedIds.has(r._id)).map(r => r.name))
      setRows(prev => prev.filter(r => failedIds.has(r._id)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onCancel}
      title={`Found ${plural(rows.length, 'item')}`}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>Discard</Button>
          <Button className="flex-1 bg-accent-grocery" onClick={confirm} disabled={saving || included.length === 0}>
            {saving ? `Adding ${included.length}` : `Add ${included.length} to the kitchen`}
          </Button>
        </div>
      }
    >
      <p className="pb-3 text-sm text-ink-2">Tap a name to fix it or move it. Anything you bought comes off the list.</p>
      {failedNames.length > 0 && (
        <p role="alert" className="mb-3 rounded-row bg-danger-tile px-3 py-2 text-sm font-semibold text-danger-ink">
          Couldn't add {failedNames.join(', ')}. They're still on the list. Tap Add to try again.
        </p>
      )}
      <div className="flex flex-col gap-4">
        <Tile tileClass="bg-control" inkClass="text-ink" heading="Adding to the kitchen" count={included.length}>
          <div className="flex flex-col gap-1.5">
            {groups.map(([loc, locRows]) => {
              const theme = locationTheme(loc)
              return (
                <div key={loc} className="flex flex-col gap-1.5">
                  <p className={`px-1.5 pt-1 text-[12px] font-semibold ${theme.ink}`}>{LOCATION_LABELS[loc] || loc}</p>
                  {locRows.map(row => (
                    <ScanItemRow
                      key={row._id}
                      item={row}
                      theme={theme}
                      expanded={expandedId === row._id}
                      onToggle={() => patch(row._id, { included: !row.included })}
                      onExpand={() => setExpandedId(prev => (prev === row._id ? null : row._id))}
                      onChange={(changes) => patch(row._id, changes)}
                      leadingFields={
                        <Field label="Location" htmlFor={`${row._id}-location`}>
                          <Select id={`${row._id}-location`} value={row.location} onChange={(e) => patch(row._id, withLocation(row, e.target.value))}>
                            {locationOptions(row.location).map(l => <option key={l} value={l}>{LOCATION_LABELS[l] || l}</option>)}
                          </Select>
                        </Field>
                      }
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </Tile>

        <Tile tileClass={GROCERY.tile} inkClass={GROCERY.ink} heading="Taking off the list" count={removing.length}>
          <div className="flex flex-col gap-1.5">
            {matches.length === 0 ? (
              <p className="rounded-row bg-surface/60 px-3 py-3 text-[13px] text-ink-2">Nothing on the list matches these items.</p>
            ) : (
              matches.map(g => <ListRow key={g.id} item={g} off={!kept.has(g.id)} onToggle={() => toggleKept(g.id)} />)
            )}
          </div>
        </Tile>
      </div>
    </Sheet>
  )
}
