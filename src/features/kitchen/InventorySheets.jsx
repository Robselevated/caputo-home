import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { TAXONOMY, DEFAULT_UNITS, UNITS } from '../../lib/constants'
import { LOCATION_LABELS } from './locationTheme'

function unitOptions(location, current) {
  const set = new Set([...UNITS, ...Object.values(DEFAULT_UNITS[location] || {})])
  if (current) set.add(current)
  return [...set]
}

// Shared form for adding and editing a kitchen item. Category drives the
// subcategory list and the default unit, as the taxonomy says.
function InventoryForm({ location, initial, submitLabel, accentBg, onSubmit, extra, autoFocusName = false }) {
  const taxonomy = TAXONOMY[location] || {}
  const categories = Object.keys(taxonomy)
  const [name, setName] = useState(initial.name || '')
  const [qty, setQty] = useState(initial.qty ?? 1)
  const [category, setCategory] = useState(initial.category || '')
  const [subcategory, setSubcategory] = useState(initial.subcategory || '')
  const [unit, setUnit] = useState(initial.unit || '')
  const [notes, setNotes] = useState(initial.notes || '')
  const subcategories = category && taxonomy[category] ? taxonomy[category] : null

  const changeCategory = (cat) => {
    setCategory(cat)
    setSubcategory('')
    setUnit(DEFAULT_UNITS[location]?.[cat] || unit || 'count')
  }

  const submit = (e) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean || !category) return
    const n = Number(qty)
    onSubmit({
      name: clean,
      qty: Number.isFinite(n) && n >= 0 ? n : 1,
      unit: unit || DEFAULT_UNITS[location]?.[category] || 'count',
      category,
      subcategory: subcategory || null,
      notes: notes.trim() || null,
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
      <Field label="Name" htmlFor="inv-name">
        <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" required autoFocus={autoFocusName} />
      </Field>
      <Field label="Category" htmlFor="inv-category">
        <Select id="inv-category" value={category} onChange={(e) => changeCategory(e.target.value)} required>
          <option value="">Choose a category</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>
      {subcategories && (
        <Field label="Type" htmlFor="inv-subcategory">
          <Select id="inv-subcategory" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
            <option value="">Any</option>
            {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-[96px_1fr] gap-3">
        <Field label="Quantity" htmlFor="inv-qty">
          <Input id="inv-qty" type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Unit" htmlFor="inv-unit">
          <Select id="inv-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="">Default</option>
            {unitOptions(location, unit).map(u => <option key={u} value={u}>{u}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="inv-notes">
        <Input id="inv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opened, brand, best by" />
      </Field>
      {extra}
      <Button type="submit" className={accentBg} disabled={!name.trim() || !category}>{submitLabel}</Button>
    </form>
  )
}

export function InventoryAddSheet({ open, location, theme, onClose, onAdd }) {
  const label = LOCATION_LABELS[location]
  return (
    <Sheet open={open} onClose={onClose} title={`Add to ${label}`}>
      {open && (
        <InventoryForm
          location={location}
          initial={{ qty: 1 }}
          submitLabel={`Add to ${label}`}
          accentBg={theme.accentBg}
          autoFocusName
          onSubmit={(values) => { onAdd(values); onClose() }}
        />
      )}
    </Sheet>
  )
}

export function InventoryEditSheet({ item, location, theme, onClose, onSave, onDelete, onBuy }) {
  return (
    <Sheet open={!!item} onClose={onClose} title="Edit item">
      {item && (
        <InventoryForm
          key={item.id}
          location={location}
          initial={item}
          submitLabel="Save"
          accentBg={theme.accentBg}
          onSubmit={(values) => { onSave(item.id, values); onClose() }}
          extra={
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => { onDelete(item); onClose() }}>Delete</Button>
              <Button variant="secondary" className="flex-1" onClick={() => { onBuy(item); onClose() }}>
                <ShoppingCart size={18} aria-hidden="true" />Add to grocery list
              </Button>
            </div>
          }
        />
      )}
    </Sheet>
  )
}
