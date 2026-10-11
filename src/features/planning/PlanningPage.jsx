import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useMealPicks } from '../../hooks/useMealPicks'
import { useRecipes } from '../../hooks/useRecipes'
import { useRecipeMatch } from '../../hooks/useRecipeMatch'
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo'
import { PageHeader } from '../../components/ui/PageHeader'
import { IconButton } from '../../components/ui/IconButton'
import { Tile } from '../../components/ui/Tile'
import { ListSkeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/Toast'
import { DEFAULT_SECTIONS, resolveSection } from '../../lib/mealSections'
import { PickCard } from './PickCard'
import { AddPickSheet } from './AddPickSheet'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// The two sections are people, not locations, so they share one neutral tint
// and the planning accent carries the heading.
function SectionTile({ section, picks, busyId, onOpen, onShop, onRemove, onAdd, onClear }) {
  return (
    <Tile tileClass="bg-control" inkClass="text-accent-planning" heading={section} count={picks.length}>
      <div className="flex flex-col gap-1.5">
        {picks.map(pick => (
          <PickCard key={pick.id} pick={pick} busy={busyId === pick.id} onOpen={onOpen} onShop={onShop} onRemove={onRemove} />
        ))}
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label={`Add a recipe to ${section}`}
            onClick={onAdd}
            className="flex h-12 flex-1 items-center gap-2.5 rounded-row bg-surface/60 pl-3 pr-2 text-[15px] font-semibold text-ink active:bg-surface"
          >
            <Plus size={20} strokeWidth={2.2} aria-hidden="true" className="text-accent-planning" />
            Add a recipe
          </button>
          {picks.length > 0 && (
            <button type="button" aria-label={`Clear ${section}`} onClick={onClear} className="h-12 rounded-row px-3.5 text-[15px] font-semibold text-ink-2 active:bg-surface">
              Clear
            </button>
          )}
        </div>
      </div>
    </Tile>
  )
}

export default function PlanningPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const userId = user?.id
  const { picks, loading, addPick, removePick, clearSection } = useMealPicks(householdId)
  const { recipes } = useRecipes(householdId)
  const { matchIngredients, addMissingToGroceryList } = useRecipeMatch(householdId)
  const { requestDelete, hiddenIds } = useDeleteWithUndo(removePick, { message: (pick) => `${pick.name} removed from the plan` })
  // A whole section goes through the same undo window; the "item" is the section name.
  const { requestDelete: requestClear, hiddenIds: clearing } = useDeleteWithUndo(clearSection, { message: (s) => `${s.name} cleared` })

  const [addingTo, setAddingTo] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const bySection = useMemo(() => {
    const map = new Map(DEFAULT_SECTIONS.map(s => [s, []]))
    for (const pick of picks) {
      const section = resolveSection(pick.section)
      if (hiddenIds.has(pick.id) || clearing.has(section)) continue
      map.get(section).push(pick)
    }
    return map
  }, [picks, hiddenIds, clearing])

  const visible = [...bySection.values()].flat()
  const fromCookbook = visible.filter(p => p.recipe_id).length
  const subtitle = loading && picks.length === 0
    ? 'Loading your plan'
    : visible.length === 0
      ? 'Nothing planned yet'
      : `${plural(visible.length, 'pick')}, ${fromCookbook} from the cookbook`

  const handleAdd = (values) => addPick({ userId, ...values })
  const handleOpen = (pick) => navigate(`/cookbook/${pick.recipe_id}`)
  const handleShop = async (pick) => {
    setBusyId(pick.id)
    try {
      const { data, error } = await matchIngredients(pick.recipe_id)
      if (error || !data) {
        toast({ message: `Couldn't check the kitchen for ${pick.name}`, tone: 'error' })
        return
      }
      if (data.missing.length === 0) {
        toast({ message: `You have everything for ${pick.name}` })
        return
      }
      const res = await addMissingToGroceryList(data.missing, pick.name, userId, householdId)
      if (res?.error) toast({ message: `Couldn't add the missing ingredients for ${pick.name}`, tone: 'error' })
      else toast({ message: `Added ${plural(data.missing.length, 'item')} to the grocery list` })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5">
      <PageHeader
        title="Planning"
        subtitle={subtitle}
        action={
          <IconButton label="Add a pick" variant="fill" size={44} className="bg-accent-planning" onClick={() => setAddingTo(DEFAULT_SECTIONS[0])}>
            <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
          </IconButton>
        }
      />

      {loading && picks.length === 0 ? (
        <ListSkeleton />
      ) : (
        DEFAULT_SECTIONS.map(section => (
          <SectionTile
            key={section}
            section={section}
            picks={bySection.get(section)}
            busyId={busyId}
            onOpen={handleOpen}
            onShop={handleShop}
            onRemove={requestDelete}
            onAdd={() => setAddingTo(section)}
            onClear={() => requestClear({ id: section, name: section })}
          />
        ))
      )}

      <AddPickSheet
        open={!!addingTo}
        section={addingTo ?? DEFAULT_SECTIONS[0]}
        sections={DEFAULT_SECTIONS}
        recipes={recipes}
        onClose={() => setAddingTo(null)}
        onAdd={handleAdd}
      />
    </div>
  )
}
