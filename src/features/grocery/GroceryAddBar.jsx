import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'

// Quick add: type, Enter or Add. Suggestions come from the household's item
// history; tapping one adds it straight away.
export function GroceryAddBar({ onAdd, getSuggestions, accentClass }) {
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)
  const blurTimer = useRef(null)
  const query = name.trim()
  const suggestions = open && query ? getSuggestions(query).filter(s => s.toLowerCase() !== query.toLowerCase()) : []

  const add = (value) => {
    const clean = value.trim()
    if (!clean) return
    setName('')
    setOpen(false)
    onAdd(clean)
  }

  const submit = (e) => {
    e.preventDefault()
    add(name)
  }

  return (
    <form aria-label="Add to list" onSubmit={submit} className="relative">
      <div className="flex items-center gap-2 rounded-tile bg-surface py-1.5 pl-4 pr-1.5 shadow-soft">
        <Plus size={20} aria-hidden="true" className="shrink-0 text-ink-3" />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => { clearTimeout(blurTimer.current); setOpen(true) }}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150) }}
          placeholder="Add to list"
          aria-label="Add to list"
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="sentences"
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
        <Button type="submit" className={accentClass}>Add</Button>
      </div>
      {suggestions.length > 0 && (
        <ul role="listbox" aria-label="Suggestions" className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-bar bg-surface shadow-lift">
          {suggestions.map((s) => (
            <li key={s} role="option" aria-selected="false">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)} className="flex h-12 w-full items-center px-4 text-left text-base text-ink active:bg-control">
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
