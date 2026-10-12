import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { toast } from '../../components/ui/Toast'
import { RecipeForm } from './RecipeForm'
import { ScanRecipeForm } from './ScanRecipeForm'
import PasteTextForm from './PasteTextForm'
import { applyParsed, emptyDraft } from './recipeDraft'
import { errorText } from './recipeFormat'
import { scanPhotos } from './recipeScan'

const MODES = [
  { value: 'url', label: 'Link', activeClass: 'text-accent-cookbook' },
  { value: 'manual', label: 'Type it', activeClass: 'text-accent-cookbook' },
  { value: 'scan', label: 'Photo', activeClass: 'text-accent-cookbook' },
  { value: 'paste', label: 'Paste', activeClass: 'text-accent-cookbook' },
]

function ImportUrlForm({ onImport }) {
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const clean = url.trim()
    if (!clean) return
    setImporting(true)
    const res = await onImport(clean)
    setImporting(false)
    if (res?.error) toast({ message: errorText(res.error, 'Could not import that recipe'), tone: 'error', durationMs: 8000 })
    else setUrl('')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
      <Field label="Recipe link" htmlFor="import-url">
        <Input id="import-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" autoComplete="off" enterKeyHint="go" required />
      </Field>
      <p className="text-[13px] text-ink-2">We read the page and pull out the ingredients and steps. You can fix anything afterwards.</p>
      <Button type="submit" className="bg-accent-cookbook" disabled={!url.trim() || importing}>{importing ? 'Importing' : 'Import recipe'}</Button>
    </form>
  )
}

function ManualRecipeForm({ draft, onDraftChange, householdId, onCreate }) {
  return (
    <RecipeForm
      draft={draft}
      onDraftChange={onDraftChange}
      householdId={householdId}
      imagePathPrefix="dish"
      idPrefix="new"
      submitLabel="Save recipe"
      onSubmit={onCreate}
    />
  )
}

// Add a recipe from a link, by typing, or from photos. The typed draft lives
// here (not in the page) so keystrokes never touch the grid, and it survives
// closing the sheet until a recipe is saved.
export function AddRecipeSheet({ open, onClose, householdId, onImport, onCreate }) {
  const [mode, setMode] = useState('url')
  const [draft, setDraft] = useState(emptyDraft)

  const handleParsed = ({ parsed }) => {
    setDraft(d => applyParsed(d, parsed))
    setMode('manual')
  }

  const handleCreate = async (recipe) => {
    const res = await onCreate(recipe)
    if (!res?.error) {
      setDraft(emptyDraft())
      setMode('url')
    }
    return res
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a recipe">
      <div className="flex flex-col gap-4 pb-2">
        <SegmentedControl label="How to add" options={MODES} value={mode} onChange={setMode} />
        {mode === 'url' && <ImportUrlForm onImport={onImport} />}
        {mode === 'manual' && (
          <ManualRecipeForm draft={draft} onDraftChange={setDraft} householdId={householdId} onCreate={handleCreate} />
        )}
        {mode === 'paste' && (
          <PasteTextForm
            onParsed={(parsed) => handleParsed({ parsed, sourceImageUrls: [] })}
            onLocalList={(d) => { setDraft(prev => applyParsed(prev, d)); setMode('manual') }}
          />
        )}
        {mode === 'scan' && (
          <ScanRecipeForm
            scan={scanPhotos}
            onParsed={handleParsed}
            hint="Pick every page of the recipe at once. We read them and fill in the form for you to check before saving."
          />
        )}
      </div>
    </Sheet>
  )
}
