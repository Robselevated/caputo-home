import { useEffect, useRef, useState } from 'react'
import { Search, MapPin, Plus } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { EmptyState } from '../../components/ui/EmptyState'
import { toast } from '../../components/ui/Toast'
import { searchPlaces, getPlace, newSessionToken, currentCoords } from './placesSearch'

const DEBOUNCE_MS = 300

// Mounted per open so the query, results and session token start fresh.
function SearchForm({ onAdd, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle') // idle | searching | done | error
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(null)
  const session = useRef(newSessionToken())
  const coords = useRef(undefined)

  // Ask for location once per open, in the background; search never waits on it
  // longer than the first keystroke.
  useEffect(() => { currentCoords().then(c => { coords.current = c }) }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); setStatus('idle'); return undefined }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setStatus('searching')
      try {
        const found = await searchPlaces(q, { coords: coords.current, sessionToken: session.current, signal: controller.signal })
        setResults(found)
        setStatus('done')
      } catch (e) {
        if (e.name === 'AbortError') return
        setError(e.message)
        setStatus('error')
      }
    }, DEBOUNCE_MS)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  const pick = async (result) => {
    setAdding(result.placeId)
    try {
      const place = await getPlace(result.placeId, { sessionToken: session.current })
      session.current = newSessionToken()
      if (!place?.name) throw new Error("Couldn't load that restaurant")
      const res = await onAdd(place)
      if (!res?.error || res.error === 'duplicate') onClose()
    } catch (e) {
      toast({ message: e.message, tone: 'error' })
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="flex items-center gap-2 rounded-bar border border-hairline bg-surface py-0.5 pl-3.5 pr-2">
        <Search size={20} aria-hidden="true" className="shrink-0 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Restaurant name"
          aria-label="Search restaurants"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus
          className="h-10 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
      </div>

      {status === 'error' ? (
        <EmptyState icon={Search} title="Search isn't working" hint={error} className="py-8" />
      ) : status === 'done' && results.length === 0 ? (
        <EmptyState icon={Search} title="No matches" hint="Try the name plus the city" className="py-8" />
      ) : status === 'idle' ? (
        <EmptyState icon={MapPin} title="Find a place" hint="Searches Google near you" className="py-8" />
      ) : (
        <ul className={`flex flex-col gap-1.5 ${status === 'searching' ? 'opacity-60' : ''}`} aria-busy={status === 'searching'}>
          {results.map(r => (
            <li key={r.placeId}>
              <button
                type="button"
                aria-label={`Add ${r.name}`}
                disabled={!!adding}
                onClick={() => pick(r)}
                className="flex w-full items-center gap-3 rounded-row bg-control py-2 pl-3 pr-2 text-left active:opacity-80 disabled:opacity-40"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="truncate text-base font-semibold text-ink">{r.name}</span>
                  {r.secondary && <span className="truncate text-[13px] text-ink-2">{r.secondary}</span>}
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-datenight text-white">
                  <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function RestaurantSearchSheet({ open, onClose, onAdd }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add a restaurant">
      {open && <SearchForm onAdd={onAdd} onClose={onClose} />}
    </Sheet>
  )
}
