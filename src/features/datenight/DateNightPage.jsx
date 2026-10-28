import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Heart, UtensilsCrossed } from 'lucide-react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { useAuth } from '../../hooks/useAuth'
import { useRestaurants, averageScore } from '../../hooks/useRestaurants'
import { useListSensors, DRAG_INSTRUCTIONS } from '../../lib/dndSensors'
import { PageHeader } from '../../components/ui/PageHeader'
import { IconButton } from '../../components/ui/IconButton'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Tile } from '../../components/ui/Tile'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSkeleton } from '../../components/ui/Skeleton'
import { RestaurantRow } from './RestaurantRow'
import { RestaurantSearchSheet } from './RestaurantSearchSheet'
import { RestaurantMap } from './RestaurantMap'
import { useBackfillLocations } from './useBackfillLocations'

const VIEWS = [
  { value: 'list', label: 'Up next' },
  { value: 'archived', label: 'Been there' },
]

// Pin colors: Google's red for places to try, grey for places we've been.
const PIN = { list: '#EA4335', archived: '#5E6464' }

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const newestVisit = (a, b) => String(b.visited_at ?? '').localeCompare(String(a.visited_at ?? ''))

function SortableRow({ restaurant, ...rest }) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: restaurant.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  }
  return <RestaurantRow restaurant={restaurant} sortable={{ setNodeRef, listeners, style }} {...rest} />
}

export default function DateNightPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { restaurants, ratings, loading, addRestaurant, reorder, setLocation } = useRestaurants(householdId)
  const sensors = useListSensors()
  const [view, setView] = useState('list')
  const [searching, setSearching] = useState(false)

  const upNext = useMemo(() => restaurants.filter(r => r.status === 'list'), [restaurants])
  const beenThere = useMemo(() => restaurants.filter(r => r.status === 'archived').sort(newestVisit), [restaurants])
  const averages = useMemo(() => {
    const byPlace = new Map()
    for (const r of ratings) byPlace.set(r.restaurant_id, [...(byPlace.get(r.restaurant_id) ?? []), r])
    return new Map([...byPlace].map(([id, rows]) => [id, averageScore(rows)]))
  }, [ratings])

  useBackfillLocations(restaurants, setLocation)
  const shown = view === 'list' ? upNext : beenThere
  const hasPins = shown.some(r => r.lat != null && r.lng != null)

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const from = upNext.findIndex(r => r.id === active.id)
    const to = upNext.findIndex(r => r.id === over.id)
    if (from === -1 || to === -1) return
    reorder(arrayMove(upNext, from, to).map(r => r.id))
  }

  const open = (r) => navigate(`/date-night/${r.id}`)
  const subtitle = loading && restaurants.length === 0
    ? 'Loading your list'
    : `${plural(upNext.length, 'place')} to try, ${beenThere.length} been`

  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5">
      <PageHeader
        title="Date Night"
        subtitle={subtitle}
        action={
          <IconButton label="Add a restaurant" variant="fill" size={44} className="bg-accent-datenight" onClick={() => setSearching(true)}>
            <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
          </IconButton>
        }
      />

      <SegmentedControl label="Date Night lists" options={VIEWS} value={view} onChange={setView} activeClass="text-accent-datenight" />

      {hasPins && <RestaurantMap restaurants={shown} color={PIN[view]} onOpen={(r) => open(r)} />}

      {loading && restaurants.length === 0 ? (
        <ListSkeleton />
      ) : view === 'list' ? (
        upNext.length === 0 ? (
          <EmptyState icon={UtensilsCrossed} title="Nothing on the list yet" hint="Tap + to search for a place you want to try" />
        ) : (
          <Tile tileClass="bg-datenight-tile" inkClass="text-datenight-ink" heading="Up next" count={upNext.length}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]} accessibility={{ screenReaderInstructions: DRAG_INSTRUCTIONS }}>
              <SortableContext items={upNext.map(r => r.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1.5">
                  {upNext.map(r => <SortableRow key={r.id} restaurant={r} onOpen={open} />)}
                </div>
              </SortableContext>
            </DndContext>
          </Tile>
        )
      ) : beenThere.length === 0 ? (
        <EmptyState icon={Heart} title="No dates logged yet" hint="Open a place and tap We went after you go" />
      ) : (
        <Tile tileClass="bg-datenight-tile" inkClass="text-datenight-ink" heading="Been there" count={beenThere.length}>
          <div className="flex flex-col gap-1.5">
            {beenThere.map(r => <RestaurantRow key={r.id} restaurant={r} average={averages.get(r.id)} onOpen={open} />)}
          </div>
        </Tile>
      )}

      <RestaurantSearchSheet open={searching} onClose={() => setSearching(false)} onAdd={(place) => addRestaurant(place, user?.id)} />
    </div>
  )
}
