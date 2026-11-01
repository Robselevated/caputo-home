import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { CheckCircle } from '../../components/ui/CheckCircle'
import { Tile } from '../../components/ui/Tile'
import { toast } from '../../components/ui/Toast'
import { errorText, ingredientDetail, plural } from './recipeFormat'

const GROCERY = { ring: 'border-accent-grocery', fill: 'bg-accent-grocery' }

const LOCATION_HINT = {
  pantry: 'In the pantry',
  fridge: 'In the fridge',
  freezer: 'In the freezer',
  home_goods: 'On hand',
}

// Every ingredient in recipe order, tagged with whether the kitchen check
// found it. Rows without a position keep the have-then-need order.
function allRows(match) {
  const rows = [
    ...match.inInventory.map((item) => ({ ...item, have: true })),
    ...match.missing.map((item) => ({ ...item, have: false })),
  ]
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => (a.row.position ?? a.i) - (b.row.position ?? b.i) || a.i - b.i)
    .map(({ row }) => row)
}

const rowKey = (row, i) => row.id ?? `row-${i}`

function IngredientRow({ row, checked, onToggle }) {
  const amount = ingredientDetail(row)
  const hint = row.have ? LOCATION_HINT[row.inventoryItem?.location] || 'In the kitchen' : null
  return (
    <div className={`flex items-center gap-2.5 rounded-row py-2 pl-3 pr-3 ${checked ? 'bg-surface' : 'bg-surface/55'}`}>
      <CheckCircle
        checked={checked}
        label={`Add ${row.name} to grocery list`}
        ringClass={GROCERY.ring}
        fillClass={GROCERY.fill}
        onClick={onToggle}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className={`truncate text-base font-semibold ${checked ? 'text-ink' : 'text-ink-2'}`}>{row.name}</span>
        {amount && <span className="truncate text-[13px] text-ink-2">{amount}</span>}
        {hint && <span className="truncate text-[13px] font-semibold text-store-pilgrims-ink">{hint}</span>}
      </div>
    </div>
  )
}

function Rows({ items, detail = ingredientDetail }) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => {
        const d = detail(item)
        return (
          <div key={item.id ?? i} className="flex flex-col gap-px rounded-row bg-surface py-2 pl-3 pr-3">
            <span className="truncate text-base font-semibold text-ink">{item.name}</span>
            {d && <span className={`truncate text-[13px] ${item.newQty === 0 ? 'font-semibold text-danger-ink' : 'text-ink-2'}`}>{d}</span>}
          </div>
        )
      })}
    </div>
  )
}

// Why "I made this" left a row alone, from the consume result's reason codes.
function skipText(item) {
  if (item.reason === 'no amount') return 'Skipped: no amount in the recipe'
  if (item.reason === 'units differ') return item.detail ? `Skipped: units differ, ${item.detail}` : 'Skipped: units differ'
  return item.reason ? `Skipped: ${item.reason}` : 'Skipped'
}

function UpdateSummary({ result }) {
  const unit = (item) => item.inventoryItem?.unit || ''
  return (
    <Tile tileClass="bg-control" inkClass="text-ink" heading={result.failed?.length ? 'Kitchen partly updated' : 'Inventory updated'} count={result.decremented.length}>
      <div className="flex flex-col gap-1.5">
        {result.failed?.length > 0 && (
          <Rows items={result.failed} detail={() => 'Did not save, still at the old amount'} />
        )}
        {result.decremented.length > 0 && (
          <Rows items={result.decremented} detail={(it) => (it.newQty === 0 ? `${it.oldQty} to 0 ${unit(it)}, now out` : `${it.oldQty} to ${it.newQty} ${unit(it)}`)} />
        )}
        {result.nowOut.length > 0 && (
          <p className="rounded-row bg-danger-tile px-3 py-2 text-[13px] font-semibold text-danger-ink">Now out: {result.nowOut.map(i => i.name).join(', ')}</p>
        )}
        {result.skipped.length > 0 && (
          <Rows items={result.skipped} detail={skipText} />
        )}
      </div>
    </Tile>
  )
}

// Inner body is its own component so its state resets every time the sheet
// opens with a new match result.
function MakeThisBody({ recipe, match, onClose, actions, userId, householdId }) {
  // `useRecipe` on the match hook is the "we cooked this" action, not a hook.
  const { addMissingToGroceryList, useRecipe: consumeRecipe, addDepletedToGroceryList } = actions
  const [rows] = useState(() => allRows(match))
  // Keys of the rows that will go on the grocery list. The kitchen's "missing"
  // rows start checked; the kitchen is often out of date, so any row can be
  // toggled before adding.
  const [selected, setSelected] = useState(() => new Set(rows.map((row, i) => (row.have ? null : rowKey(row, i))).filter(Boolean)))
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const toggle = (key) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const addChecked = async () => {
    const items = rows.filter((row, i) => selected.has(rowKey(row, i)))
    setBusy(true)
    const res = await addMissingToGroceryList(items, recipe.name, userId, householdId)
    setBusy(false)
    if (res?.error) { toast({ message: errorText(res.error, 'Could not add those to the list'), tone: 'error' }); return }
    if (!res?.added) { toast({ message: 'Nothing to add from those', tone: 'error' }); return }
    toast({ message: `Added ${plural(res.added, 'item')} to the grocery list` })
    onClose()
  }

  const makeIt = async () => {
    setBusy(true)
    const r = await consumeRecipe(match, recipe.name, userId)
    setBusy(false)
    setResult(r)
    if (r?.failedCount > 0) {
      toast({ message: `${plural(r.failedCount, 'kitchen update')} did not save. Check your connection and try again.`, tone: 'error', durationMs: 6000 })
    }
  }

  const addDepleted = async () => {
    setBusy(true)
    const { error } = await addDepletedToGroceryList(result.nowOut, recipe.name, userId)
    setBusy(false)
    if (error) { toast({ message: errorText(error, 'Could not add those to the list'), tone: 'error' }); return }
    toast({ message: `Added ${plural(result.nowOut.length, 'item')} to the grocery list` })
    onClose()
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      {!result && (
        <>
          <p className="text-[13px] text-ink-2">Checked items go on the grocery list. Uncheck what you already have.</p>
          <div className="flex flex-col gap-1.5">
            {rows.map((row, i) => {
              const key = rowKey(row, i)
              return <IngredientRow key={key} row={row} checked={selected.has(key)} onToggle={() => toggle(key)} />
            })}
          </div>
        </>
      )}

      {result && <UpdateSummary result={result} />}

      <div className="flex flex-col gap-2">
        {!result && (
          <Button className="bg-accent-grocery" onClick={addChecked} disabled={busy || selected.size === 0}>
            <ShoppingCart size={18} aria-hidden="true" />Add {selected.size} to grocery list
          </Button>
        )}
        {!result && match.inInventory.length > 0 && (
          <Button variant="secondary" onClick={makeIt} disabled={busy}>{busy ? 'Updating the kitchen' : 'I made this'}</Button>
        )}
        {result && result.nowOut.length > 0 && (
          <Button className="bg-accent-grocery" onClick={addDepleted} disabled={busy}>
            <ShoppingCart size={18} aria-hidden="true" />Add {result.nowOut.length} depleted to grocery list
          </Button>
        )}
        {result && <Button variant="secondary" onClick={onClose}>Done</Button>}
      </div>
    </div>
  )
}

// "Make this": every ingredient as a checklist, with what the kitchen lacks
// pre-checked, then the option to add the checked rows to the grocery list or
// consume the recipe (decrement inventory) and shop for what ran out.
export function MakeThisSheet({ recipe, match, onClose, actions, userId, householdId }) {
  return (
    <Sheet open={!!match} onClose={onClose} title="Make this">
      {match && <MakeThisBody recipe={recipe} match={match} onClose={onClose} actions={actions} userId={userId} householdId={householdId} />}
    </Sheet>
  )
}
