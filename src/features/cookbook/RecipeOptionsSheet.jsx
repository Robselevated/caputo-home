import { useState } from 'react'
import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'

function OptionRow({ icon: Icon, label, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 items-center gap-3 rounded-row bg-surface px-4 text-left text-base font-semibold active:opacity-80 disabled:opacity-40 ${danger ? 'text-danger-ink' : 'text-ink'}`}
    >
      <Icon size={20} aria-hidden="true" className={danger ? 'text-danger-ink' : 'text-ink-3'} />
      {label}
    </button>
  )
}

// Kebab sheet for the detail page. Deleting a recipe navigates away, which
// would flush an undo window at once, so this one asks first instead.
export function RecipeOptionsSheet({ open, recipe, refreshing, onClose, onEdit, onRefresh, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const close = () => { setConfirming(false); onClose() }
  const confirmDelete = async () => {
    setDeleting(true)
    await onDelete()
    setDeleting(false)
    close()
  }

  return (
    <>
      <Sheet open={open && !confirming} onClose={onClose} title="Recipe options">
        <div className="mb-2 flex flex-col gap-1.5 rounded-tile bg-control p-2.5">
          <OptionRow icon={Pencil} label="Edit recipe" onClick={() => { onClose(); onEdit() }} />
          {recipe.source_url && (
            <OptionRow icon={RefreshCw} label={refreshing ? 'Refreshing' : 'Refresh from link'} disabled={refreshing} onClick={onRefresh} />
          )}
          <OptionRow icon={Trash2} label="Delete recipe" danger onClick={() => setConfirming(true)} />
        </div>
      </Sheet>

      <Sheet
        open={open && confirming}
        onClose={close}
        title={`Delete ${recipe.name}?`}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={close}>Keep it</Button>
            <Button variant="danger" className="flex-1" onClick={confirmDelete} disabled={deleting}>Delete recipe</Button>
          </div>
        }
      >
        <p className="pb-2 text-[15px] text-ink-2">This removes the recipe and its ingredients for everyone in the house.</p>
      </Sheet>
    </>
  )
}
