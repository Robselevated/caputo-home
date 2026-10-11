import { useId } from 'react'
import { CircleAlert } from 'lucide-react'
import { CheckCircle } from '../../components/ui/CheckCircle'
import { Stepper } from '../../components/ui/Stepper'
import { Field, Input, Select } from '../../components/ui/Field'
import { TAXONOMY } from '../../lib/constants'
import { unitOptions, withCategory } from './scanItems'

// One scanned item: include toggle, name (tap to edit), quantity stepper. The
// editor opens inline under the row; `leadingFields` lets the receipt sheet
// put its location picker first.
export function ScanItemRow({ item, theme, expanded, onToggle, onExpand, onChange, leadingFields }) {
  const id = useId()
  const taxonomy = TAXONOMY[item.location] || {}
  const categories = Object.keys(taxonomy)
  // The scanner can hand back a category the taxonomy no longer has; keep it
  // selectable so the select shows what will actually be saved.
  const categoryOptions = categories.includes(item.category) ? categories : [item.category, ...categories]
  const subcategories = taxonomy[item.category] || null
  const detail = [item.category, item.subcategory, item.unit].filter(Boolean).join(', ')

  return (
    <div className={`rounded-row ${item.included ? 'bg-surface' : 'bg-surface/55'}`}>
      <div className="flex items-center gap-2.5 py-2 pl-3 pr-2">
        <CheckCircle
          checked={item.included}
          label={`Include ${item.name}`}
          ringClass={theme.ring}
          fillClass={theme.accentBg}
          onClick={onToggle}
        />
        <button
          type="button"
          aria-label={`Edit ${item.name}`}
          aria-expanded={expanded}
          onClick={onExpand}
          className="flex min-w-0 flex-1 flex-col items-start gap-px py-1 text-left"
        >
          <span className={`w-full truncate text-base font-semibold ${item.included ? 'text-ink' : 'text-ink-2 line-through'}`}>{item.name}</span>
          {detail && <span className="w-full truncate text-[13px] text-ink-2">{detail}</span>}
        </button>
        <Stepper
          value={item.qty}
          name={item.name}
          plusClass={theme.accentBg}
          minusDisabled={item.qty <= 1}
          onMinus={() => onChange({ qty: Math.max(1, item.qty - 1) })}
          onPlus={() => onChange({ qty: item.qty + 1 })}
        />
      </div>

      {item.needs_verification && (
        <p className={`flex items-start gap-1.5 px-3 pb-2.5 text-[13px] font-medium ${theme.ink}`}>
          <CircleAlert size={16} aria-hidden="true" className="mt-px shrink-0" />
          <span>{item.verification_prompt || 'Check this one before adding it'}</span>
        </p>
      )}

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-hairline px-3 pb-3 pt-3">
          {leadingFields}
          <Field label="Name" htmlFor={`${id}-name`}>
            <Input id={`${id}-name`} value={item.name} onChange={(e) => onChange({ name: e.target.value })} autoComplete="off" />
          </Field>
          {categories.length > 0 && (
            <Field label="Category" htmlFor={`${id}-category`}>
              <Select id={`${id}-category`} value={item.category} onChange={(e) => onChange(withCategory(item, e.target.value))}>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          )}
          {subcategories && (
            <Field label="Type" htmlFor={`${id}-type`}>
              <Select id={`${id}-type`} value={item.subcategory} onChange={(e) => onChange({ subcategory: e.target.value })}>
                <option value="">Any</option>
                {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Unit" htmlFor={`${id}-unit`}>
            <Select id={`${id}-unit`} value={item.unit} onChange={(e) => onChange({ unit: e.target.value })}>
              {unitOptions(item.location, item.unit).map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
        </div>
      )}
    </div>
  )
}
