import { ShoppingCart, X } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'

// One pick inside a section tile. Recipe picks open the recipe and can shop
// for whatever the kitchen is missing; quick ideas are a name and a note.
export function PickCard({ pick, busy, onOpen, onShop, onRemove }) {
  const hasRecipe = !!pick.recipe_id
  const meta = pick.notes || (hasRecipe ? '' : 'Quick idea')
  const text = (
    <>
      <span className="w-full truncate text-base font-semibold text-ink">{pick.name}</span>
      {meta && <span className="w-full truncate text-[13px] text-ink-2">{meta}</span>}
    </>
  )

  return (
    <div className="flex items-center gap-2 rounded-row bg-surface py-2 pl-3 pr-1">
      {pick.image_url && <img src={pick.image_url} alt="" className="h-10 w-10 shrink-0 rounded-sm2 object-cover" />}
      {hasRecipe ? (
        <button type="button" aria-label={`Open ${pick.name}`} onClick={() => onOpen(pick)} className="flex min-w-0 flex-1 flex-col items-start gap-px py-1 text-left">
          {text}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col items-start gap-px py-1">{text}</div>
      )}
      {hasRecipe && (
        <button
          type="button"
          aria-label={`Add missing ingredients for ${pick.name} to the grocery list`}
          disabled={busy}
          onClick={() => onShop(pick)}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-sm2 bg-store-pilgrims-tile px-3 text-sm font-semibold text-store-pilgrims-ink active:opacity-80 disabled:opacity-40"
        >
          <ShoppingCart size={18} aria-hidden="true" />
          {busy ? 'Checking' : 'Shop'}
        </button>
      )}
      <IconButton label={`Remove ${pick.name}`} onClick={() => onRemove(pick)}>
        <X size={20} aria-hidden="true" />
      </IconButton>
    </div>
  )
}
