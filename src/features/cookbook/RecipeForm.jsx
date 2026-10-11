import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { toast } from '../../components/ui/Toast'
import { DishImageField } from './DishImageField'
import { IngredientsEditor } from './IngredientsEditor'
import { ScanRecipeForm } from './ScanRecipeForm'
import { Textarea } from './Textarea'
import { applyParsed, draftToRecipe } from './recipeDraft'
import { errorText } from './recipeFormat'

// One form for "Type it" and "Edit recipe". Either uncontrolled (`initial`)
// or controlled (`draft` + `onDraftChange`) so the add sheet can keep a
// half-typed recipe across close and reopen. `scanner`, when given, adds a
// "Fill from photos" block that merges a scan into the current draft.
export function RecipeForm({ initial, draft: controlled, onDraftChange, submitLabel, onSubmit, householdId, imagePathPrefix, idPrefix, scanner, sourceImageUrls = [], footer }) {
  const [inner, setInner] = useState(() => initial)
  const draft = controlled ?? inner
  const update = (fn) => (onDraftChange ? onDraftChange(fn) : setInner(fn))
  const set = (field) => (e) => { const value = e.target.value; update(d => ({ ...d, [field]: value })) }
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!draft.name.trim()) {
      toast({ message: 'Add a recipe name to save it.', tone: 'error' })
      return
    }
    setSaving(true)
    try {
      const res = await onSubmit(draftToRecipe(draft))
      if (res?.error) toast({ message: errorText(res.error, 'Could not save the recipe. Check your connection and try again.'), tone: 'error', durationMs: 6000 })
    } finally {
      setSaving(false)
    }
  }

  const sources = sourceImageUrls.length ? sourceImageUrls : (draft.sourceImageUrl ? [draft.sourceImageUrl] : [])
  const id = (suffix) => `${idPrefix}-${suffix}`

  return (
    <form onSubmit={submit} aria-label={submitLabel} className="flex flex-col gap-4 pb-2">
      {sources.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Scanned from</span>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {sources.map((src, i) => (
              <img key={src} src={src} alt={`Source photo ${i + 1}`} loading="lazy" className="h-20 w-20 shrink-0 rounded-sm2 bg-control object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            ))}
          </div>
        </div>
      )}

      <Field label="Name" htmlFor={id('name')}>
        <Input id={id('name')} value={draft.name} onChange={set('name')} placeholder="Recipe name" autoComplete="off" required />
      </Field>
      <Field label="Description" htmlFor={id('description')}>
        <Textarea id={id('description')} value={draft.description} onChange={set('description')} rows={2} placeholder="What it is, when you make it" />
      </Field>

      <DishImageField value={draft.imageUrl} onChange={(v) => update(d => ({ ...d, imageUrl: v }))} householdId={householdId} pathPrefix={imagePathPrefix} idPrefix={idPrefix} />

      <div className="grid grid-cols-3 gap-2">
        <Field label="Servings" htmlFor={id('servings')}>
          <Input id={id('servings')} type="number" inputMode="numeric" min="0" value={draft.servings} onChange={set('servings')} className="px-3" />
        </Field>
        <Field label="Prep (min)" htmlFor={id('prep')}>
          <Input id={id('prep')} type="number" inputMode="numeric" min="0" value={draft.prepTime} onChange={set('prepTime')} className="px-3" />
        </Field>
        <Field label="Cook (min)" htmlFor={id('cook')}>
          <Input id={id('cook')} type="number" inputMode="numeric" min="0" value={draft.cookTime} onChange={set('cookTime')} className="px-3" />
        </Field>
      </div>

      <Field label="Tags" htmlFor={id('tags')}>
        <Input id={id('tags')} value={draft.tags} onChange={set('tags')} placeholder="Mexican, quick, chicken" autoComplete="off" />
      </Field>

      <IngredientsEditor ingredients={draft.ingredients} onChange={(rows) => update(d => ({ ...d, ingredients: rows }))} />

      {scanner && (
        <section className="flex flex-col gap-2 rounded-row bg-control p-3">
          <h3 className="font-heading text-[15px] font-bold text-ink">Fill from photos</h3>
          <ScanRecipeForm
            scan={scanner}
            hint="Screenshots of the ingredients and steps fill in the fields on this page. Anything already typed stays unless the photo has it."
            onParsed={({ parsed, sourceImageUrls: urls }) => update(d => applyParsed(d, parsed, urls[0]))}
          />
        </section>
      )}

      <Field label="Instructions" htmlFor={id('instructions')}>
        <Textarea id={id('instructions')} value={draft.instructions} onChange={set('instructions')} rows={5} placeholder="One step per line" />
      </Field>
      <Field label="Notes" htmlFor={id('notes')}>
        <Textarea id={id('notes')} value={draft.notes} onChange={set('notes')} rows={3} placeholder="Tweaks, swaps, what worked" />
      </Field>

      <div className="mt-1 flex gap-2">
        {footer}
        <Button type="submit" className="flex-1 bg-accent-cookbook" disabled={saving}>{saving ? 'Saving' : submitLabel}</Button>
      </div>
    </form>
  )
}
