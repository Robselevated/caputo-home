import { useMemo, useState } from 'react'
import { Search, Plus, BookOpen } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Pill } from '../../components/ui/Pill'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Field, Input } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'

const MODES = [
  { value: 'cookbook', label: 'From the cookbook' },
  { value: 'quick', label: 'Quick idea' },
]

function RecipeChoice({ recipe, disabled, onPick }) {
  return (
    <li>
      <button
        type="button"
        aria-label={`Add ${recipe.name}`}
        disabled={disabled}
        onClick={onPick}
        className="flex w-full items-center gap-3 rounded-row bg-control py-2 pl-3 pr-2 text-left active:opacity-80 disabled:opacity-40"
      >
        {recipe.image_url ? (
          <img src={recipe.image_url} alt="" className="h-10 w-10 shrink-0 rounded-sm2 object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm2 bg-track">
            <BookOpen size={18} aria-hidden="true" className="text-ink-3" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-base font-semibold text-ink">{recipe.name}</span>
          {recipe.tags?.length > 0 && <span className="truncate text-[13px] text-ink-2">{recipe.tags.slice(0, 3).join(', ')}</span>}
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-planning text-white">
          <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
        </span>
      </button>
    </li>
  )
}

// Keyed per open from the sheet so every field starts fresh.
function AddPickForm({ initialSection, sections, recipes, onAdd, onClose }) {
  const [section, setSection] = useState(initialSection)
  const [mode, setMode] = useState('cookbook')
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? recipes.filter(r => r.name.toLowerCase().includes(q)) : recipes
  }, [recipes, search])

  // The hook toasts on failure; the sheet stays open so a typed idea survives
  // and Add can be tapped again.
  const submit = async (values) => {
    setAdding(true)
    let res
    try {
      res = await onAdd({ ...values, section })
    } catch (error) {
      res = { error }
    } finally {
      setAdding(false)
    }
    if (!res?.error) onClose()
  }

  const submitQuick = (e) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    submit({ recipeId: null, name: clean, notes: notes.trim() || null, imageUrl: null })
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <fieldset>
        <legend className="mb-1.5 block text-[13px] font-semibold text-ink-2">Add to</legend>
        <div className="flex flex-wrap gap-1.5">
          {sections.map(s => (
            <Pill key={s} active={section === s} activeClass="bg-accent-planning text-white" onClick={() => setSection(s)}>{s}</Pill>
          ))}
        </div>
      </fieldset>

      <SegmentedControl label="How to add" options={MODES} value={mode} onChange={setMode} activeClass="text-accent-planning" />

      {mode === 'cookbook' ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-bar border border-hairline bg-surface py-0.5 pl-3.5 pr-2">
            <Search size={20} aria-hidden="true" className="shrink-0 text-ink-3" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes"
              aria-label="Search recipes"
              enterKeyHint="search"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
            />
          </div>
          {recipes.length === 0 ? (
            <EmptyState icon={BookOpen} title="No recipes yet" hint="Import one in the Cookbook, or add a quick idea" className="py-8" />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Search} title="No matches" hint="Try a shorter word, or add it as a quick idea" className="py-8" />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {filtered.map(r => (
                <RecipeChoice
                  key={r.id}
                  recipe={r}
                  disabled={adding}
                  onPick={() => submit({ recipeId: r.id, name: r.name, notes: r.description, imageUrl: r.image_url })}
                />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <form onSubmit={submitQuick} className="flex flex-col gap-4">
          <Field label="Name" htmlFor="pick-name">
            <Input id="pick-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Taco Tuesday" autoComplete="off" required />
          </Field>
          <Field label="Notes" htmlFor="pick-notes">
            <Input id="pick-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Use the leftover chicken" />
          </Field>
          <Button type="submit" className="bg-accent-planning" disabled={!name.trim() || adding}>
            {adding ? 'Adding' : `Add to ${section}`}
          </Button>
        </form>
      )}
    </div>
  )
}

export function AddPickSheet({ open, section, sections, recipes, onClose, onAdd }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add a pick">
      {open && <AddPickForm initialSection={section} sections={sections} recipes={recipes} onAdd={onAdd} onClose={onClose} />}
    </Sheet>
  )
}
