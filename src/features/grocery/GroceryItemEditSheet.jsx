import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Pill } from '../../components/ui/Pill'
import { STORES, UNITS } from '../../lib/constants'
import { storeTheme, storeLabel } from './storeTheme'

function EditForm({ item, onSave, onDelete, onClose }) {
  const [name, setName] = useState(item.name)
  const [qty, setQty] = useState(item.qty ?? 1)
  const [unit, setUnit] = useState(item.unit || '')
  const [store, setStore] = useState(storeLabel(item.store))
  const [notes, setNotes] = useState(item.notes || '')
  const stores = STORES.includes(store) ? STORES : [...STORES, store]
  const units = unit && !UNITS.includes(unit) ? [...UNITS, unit] : UNITS

  const submit = (e) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    const n = Number(qty)
    onSave(item.id, {
      name: clean,
      qty: Number.isFinite(n) && n > 0 ? n : 1,
      unit: unit || null,
      store: store === 'Grocery Store' ? null : store,
      notes: notes.trim() || null,
    })
    onClose()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
      <Field label="Name" htmlFor="edit-name">
        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" required />
      </Field>
      <div className="grid grid-cols-[96px_1fr] gap-3">
        <Field label="Quantity" htmlFor="edit-qty">
          <Input id="edit-qty" type="number" inputMode="decimal" min="1" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Unit" htmlFor="edit-unit">
          <Select id="edit-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="">None</option>
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </Select>
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 block text-[13px] font-semibold text-ink-2">Store</legend>
        <div className="flex flex-wrap gap-1.5">
          {stores.map((s) => {
            const t = storeTheme(s)
            return (
              <Pill key={s} active={store === s} activeClass={`${t.accentBg} text-white`} inactiveClass={`${t.tile} ${t.ink}`} onClick={() => setStore(s)}>
                {s}
              </Pill>
            )
          })}
        </div>
      </fieldset>
      <Field label="Notes" htmlFor="edit-notes">
        <Input id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brand, size, substitutions" />
      </Field>
      <div className="mt-1 flex gap-2">
        <Button variant="danger" onClick={() => { onDelete(item); onClose() }}>Delete</Button>
        <Button type="submit" className="flex-1 bg-accent-grocery">Save</Button>
      </div>
    </form>
  )
}

export function GroceryItemEditSheet({ item, onClose, onSave, onDelete }) {
  return (
    <Sheet open={!!item} onClose={onClose} title="Edit item">
      {item && <EditForm key={item.id} item={item} onSave={onSave} onDelete={onDelete} onClose={onClose} />}
    </Sheet>
  )
}
