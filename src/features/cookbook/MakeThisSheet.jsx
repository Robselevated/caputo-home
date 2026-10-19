import { useState } from 'react'
import { CircleCheck, ShoppingCart } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Tile } from '../../components/ui/Tile'
import { toast } from '../../components/ui/Toast'
import { errorText, ingredientDetail, plural } from './recipeFormat'

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
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const addMissing = async () => {
    setBusy(true)
    const res = await addMissingToGroceryList(match.missing, recipe.name, userId, householdId)
    setBusy(false)
    if (res?.error) { toast({ message: errorText(res.error, 'Could not add those to the list'), tone: 'error' }); return }
    toast({ message: `Added ${plural(match.missing.length, 'item')} to the grocery list` })
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
      {match.inInventory.length > 0 && (
        <Tile tileClass="bg-store-pilgrims-tile" inkClass="text-store-pilgrims-ink" heading="You have" count={match.inInventory.length}>
          <Rows items={match.inInventory} />
        </Tile>
      )}
      {match.missing.length > 0 ? (
        <Tile tileClass="bg-danger-tile" inkClass="text-danger-ink" heading="You need" count={match.missing.length}>
          <Rows items={match.missing} />
        </Tile>
      ) : (
        <p className="flex items-center gap-2 rounded-row bg-store-pilgrims-tile px-4 py-3 text-[15px] font-semibold text-store-pilgrims-ink">
          <CircleCheck size={20} aria-hidden="true" />You have everything for this one
        </p>
      )}

      {result && <UpdateSummary result={result} />}

      <div className="flex flex-col gap-2">
        {!result && match.inInventory.length > 0 && (
          <Button className="bg-accent-cookbook" onClick={makeIt} disabled={busy}>{busy ? 'Updating the kitchen' : 'I made this'}</Button>
        )}
        {!result && match.missing.length > 0 && (
          <Button variant="secondary" onClick={addMissing} disabled={busy}>
            <ShoppingCart size={18} aria-hidden="true" />Add {match.missing.length} to grocery list
          </Button>
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

// "Make this": what the kitchen has and lacks for this recipe, then the
// option to consume it (decrement inventory) and shop for what ran out.
export function MakeThisSheet({ recipe, match, onClose, actions, userId, householdId }) {
  return (
    <Sheet open={!!match} onClose={onClose} title="Make this">
      {match && <MakeThisBody recipe={recipe} match={match} onClose={onClose} actions={actions} userId={userId} householdId={householdId} />}
    </Sheet>
  )
}
