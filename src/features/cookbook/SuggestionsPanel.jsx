import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useRecipeSuggestions } from '../../hooks/useRecipeSuggestions'
import { Button } from '../../components/ui/Button'
import { Tile } from '../../components/ui/Tile'
import { toast } from '../../components/ui/Toast'

function SuggestionCard({ suggestion, onOpen }) {
  const matched = suggestion.matched_ingredients?.length ?? 0
  const missing = suggestion.missing_ingredients ?? []
  const total = matched + missing.length
  const pct = total ? Math.round((matched / total) * 100) : 0
  const meta = [suggestion.time_estimate && `${suggestion.time_estimate} min`, suggestion.difficulty, ...(suggestion.tags || [])].filter(Boolean).join(', ')
  return (
    <button type="button" onClick={onOpen} className="flex flex-col gap-1 rounded-row bg-surface px-3 py-2.5 text-left active:opacity-80">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-base font-semibold text-ink">{suggestion.name}</span>
        <span className="shrink-0 text-[13px] font-semibold text-ink-2">{pct}% match</span>
      </span>
      {suggestion.description && <span className="text-[13px] text-ink-2">{suggestion.description}</span>}
      {meta && <span className="text-[13px] text-ink-2">{meta}</span>}
      {missing.length > 0 && <span className="text-[13px] text-ink-2">Missing: {missing.join(', ')}</span>}
    </button>
  )
}

// "What can I make?": meal ideas from what is in the kitchen. The hook state
// lives here so a fetch never re-renders the recipe grid.
export function SuggestionsPanel({ householdId }) {
  const navigate = useNavigate()
  const { suggestions, loading, error, fetchSuggestions } = useRecipeSuggestions(householdId)

  useEffect(() => {
    if (error) toast({ message: error, tone: 'error', durationMs: 6000 })
  }, [error])

  const count = suggestions.length ? `${suggestions.length} ideas` : <Sparkles size={18} aria-hidden="true" />

  return (
    <Tile tileClass="bg-store-grocery-tile" inkClass="text-store-grocery-ink" heading="What can I make?" count={count}>
      <div className="flex flex-col gap-1.5">
        {loading ? (
          <p role="status" className="flex items-center gap-2 rounded-row bg-surface px-3 py-3 text-sm text-ink-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            Checking the kitchen
          </p>
        ) : suggestions.length === 0 ? (
          <>
            <p className="px-1.5 pb-1 text-[13px] text-store-grocery-ink">Ideas built from what is in the pantry, fridge and freezer right now.</p>
            <Button className="bg-accent-cookbook" onClick={fetchSuggestions}>Get ideas</Button>
          </>
        ) : (
          <>
            {suggestions.map((s) => (
              <SuggestionCard key={s.name} suggestion={s} onOpen={() => navigate('/cookbook/suggestion', { state: { suggestion: s } })} />
            ))}
            <Button variant="secondary" onClick={fetchSuggestions}>Fresh ideas</Button>
          </>
        )}
      </div>
    </Tile>
  )
}
