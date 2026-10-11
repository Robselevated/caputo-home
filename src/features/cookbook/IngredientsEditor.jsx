import { useState } from 'react'
import { ClipboardPaste, ListPlus, Plus, Unlink, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Input } from '../../components/ui/Field'
import { parseIngredientBlock } from '../../lib/parseQty'
import { emptyIngredient } from './recipeDraft'
import { groupBySection } from './recipeFormat'
import { Textarea } from './Textarea'

function IngredientRow({ ing, index, canRemove, onChange, onRemove }) {
  const n = index + 1
  return (
    <div className="flex flex-col gap-2 rounded-row bg-control p-2">
      <div className="flex gap-2">
        <Input aria-label={`Ingredient ${n} name`} placeholder="Ingredient" value={ing.name} onChange={(e) => onChange(index, 'name', e.target.value)} autoComplete="off" />
        {canRemove && (
          <IconButton label={`Remove ingredient ${n}`} variant="outline" size={48} onClick={() => onRemove(index)}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        )}
      </div>
      <div className="grid grid-cols-[76px_1fr_1fr] gap-2">
        <Input aria-label={`Ingredient ${n} quantity`} placeholder="Qty" inputMode="decimal" value={ing.qty} onChange={(e) => onChange(index, 'qty', e.target.value)} className="px-3" />
        <Input aria-label={`Ingredient ${n} unit`} placeholder="Unit" value={ing.unit} onChange={(e) => onChange(index, 'unit', e.target.value)} className="px-3" />
        <Input aria-label={`Ingredient ${n} notes`} placeholder="Notes" value={ing.notes} onChange={(e) => onChange(index, 'notes', e.target.value)} className="px-3" />
      </div>
    </div>
  )
}

// Ingredient rows grouped by section, plus "Paste a list" which turns a
// pasted block into rows. Quantities are kept as typed; parsing happens on
// save so "1/2" is never shown back as 0.5.
export function IngredientsEditor({ ingredients, onChange }) {
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const update = (index, field, value) => onChange(ingredients.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)))
  const remove = (index) => { if (ingredients.length > 1) onChange(ingredients.filter((_, i) => i !== index)) }
  const addRow = (section) => onChange([...ingredients, emptyIngredient(section || ingredients[ingredients.length - 1]?.section || '')])
  const addSection = () => onChange([...ingredients, emptyIngredient('New section')])
  const renameSection = (from, to) => onChange(ingredients.map(ing => (ing.section === from ? { ...ing, section: to } : ing)))
  const ungroup = (name) => onChange(ingredients.map(ing => (ing.section === name ? { ...ing, section: '' } : ing)))

  const closePaste = () => { setPasting(false); setPasteText('') }
  const applyPaste = () => {
    const parsed = parseIngredientBlock(pasteText)
    if (parsed.length) onChange([...ingredients.filter(i => i.name.trim()), ...parsed])
    closePaste()
  }

  const groups = groupBySection(ingredients.map((ing, index) => ({ ...ing, index })))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink-2">Ingredients</span>
        {!pasting && (
          <button type="button" onClick={() => setPasting(true)} className="flex h-10 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-accent-cookbook active:bg-control">
            <ClipboardPaste size={16} aria-hidden="true" />Paste a list
          </button>
        )}
      </div>

      {pasting && (
        <div className="flex flex-col gap-2 rounded-row bg-control p-2">
          <Textarea
            aria-label="Pasted ingredient list"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            autoFocus
            placeholder={'One ingredient per line:\n2 cups flour\n1/2 tsp salt\n3 eggs'}
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-accent-cookbook" onClick={applyPaste} disabled={!pasteText.trim()}>Add these</Button>
            <Button size="sm" variant="ghost" onClick={closePaste}>Cancel</Button>
          </div>
        </div>
      )}

      {groups.map((group, gi) => (
        <div key={gi} className={`flex flex-col gap-2 ${gi > 0 ? 'border-t border-hairline pt-3' : ''}`}>
          {group.name && (
            <div className="flex gap-2">
              <Input aria-label="Section name" value={group.name} onChange={(e) => renameSection(group.name, e.target.value)} className="font-semibold" />
              <IconButton label={`Ungroup ${group.name}`} variant="outline" size={48} onClick={() => ungroup(group.name)}>
                <Unlink size={20} aria-hidden="true" />
              </IconButton>
            </div>
          )}
          {group.items.map((ing) => (
            <IngredientRow key={ing.index} ing={ing} index={ing.index} canRemove={ingredients.length > 1} onChange={update} onRemove={remove} />
          ))}
          <button type="button" onClick={() => addRow(group.name)} className="flex h-10 items-center gap-1 self-start rounded-full px-2.5 text-[15px] font-semibold text-accent-cookbook active:bg-control">
            <Plus size={18} aria-hidden="true" />Add ingredient
          </button>
        </div>
      ))}

      <Button variant="secondary" onClick={addSection}>
        <ListPlus size={18} aria-hidden="true" />Add a section
      </Button>
    </div>
  )
}
