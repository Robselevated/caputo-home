import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Search, Plus, PackageOpen, Camera } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useInventory } from '../../hooks/useInventory'
import { useScanSession } from '../../hooks/useScanSession'
import { useCategoryOrder } from '../../hooks/useCategoryOrder'
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo'
import { PageHeader } from '../../components/ui/PageHeader'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { IconButton } from '../../components/ui/IconButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSkeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/Toast'
import PhotoScanner from '../../components/PhotoScanner'
import ScanReview from '../../pages/ScanReview'
import { InventoryCategory } from './InventoryCategory'
import { InventoryAddSheet, InventoryEditSheet } from './InventorySheets'
import { LOCATIONS, LOCATION_LABELS, locationTheme } from './locationTheme'

const SEGMENTS = LOCATIONS.map(l => ({ value: l, label: LOCATION_LABELS[l], activeClass: locationTheme(l).accentText }))

function SortableCategory(props) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: props.category, disabled: props.dragDisabled })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : undefined, position: 'relative', zIndex: isDragging ? 10 : undefined }
  return (
    <div ref={setNodeRef} style={style}>
      <InventoryCategory {...props} dragHandleProps={props.dragDisabled ? undefined : listeners} />
    </div>
  )
}

export default function KitchenPage({ location }) {
  const navigate = useNavigate()
  const theme = locationTheme(location)
  const label = LOCATION_LABELS[location]
  const lower = label.toLowerCase()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const userId = user?.id
  const { items, loading, addItem, updateQty, updateItem, deleteItem, addToGroceryList } = useInventory(householdId, location)
  const { scanning, results, error: scanError, uploadAndScan, confirmItems, cancelScan } = useScanSession(householdId)
  const { orderedCategories, reorder } = useCategoryOrder(location)
  const { requestDelete, hiddenIds } = useDeleteWithUndo(deleteItem, { message: (item) => `${item.name} removed from ${label}` })

  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [collapsed, setCollapsed] = useState(() => new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } })
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(i => !hiddenIds.has(i.id) && (!q || i.name.toLowerCase().includes(q)))
  }, [items, hiddenIds, search])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const item of visible) {
      const cat = item.category || 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(item)
    }
    const known = orderedCategories.filter(c => map.has(c))
    const extra = [...map.keys()].filter(c => !orderedCategories.includes(c)).sort()
    return [...known, ...extra].map(c => [c, map.get(c)])
  }, [visible, orderedCategories])

  const total = items.filter(i => !hiddenIds.has(i.id)).length
  const outCount = items.filter(i => !hiddenIds.has(i.id) && i.qty === 0).length
  const subtitle = loading && items.length === 0
    ? 'Loading'
    : total === 0
      ? `Nothing in the ${lower} yet`
      : `${label}, ${total} item${total === 1 ? '' : 's'}${outCount ? `, ${outCount} out` : ''}`

  const handleQty = (item, delta) => updateQty(item.id, (item.qty ?? 0) + delta, userId)
  const handleSave = (id, changes) => updateItem(id, changes, userId)
  const handleBuy = async (item) => {
    const res = await addToGroceryList(item, userId)
    if (!res?.error) toast({ message: `${item.name} added to the grocery list` })
  }
  const handleAdd = async (values) => {
    const res = await addItem({ ...values, userId })
    if (res?.merged) {
      const total = res.item?.qty
      toast({ message: `${values.name} was already in the ${lower}${total != null ? `, now ${total}` : ''}` })
    }
  }
  const toggle = (cat) => setCollapsed(prev => {
    const next = new Set(prev)
    if (next.has(cat)) next.delete(cat); else next.add(cat)
    return next
  })

  const dragDisabled = search.trim().length > 0

  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5">
      <PageHeader
        title="Kitchen"
        subtitle={subtitle}
        action={<PhotoScanner label={`Scan the ${lower}`} icon={Camera} scanning={scanning} onCapture={(file) => uploadAndScan(file, location, userId)} />}
      />

      <SegmentedControl label="Location" options={SEGMENTS} value={location} onChange={(loc) => navigate(`/kitchen/${loc}`)} />

      <div className="flex items-center gap-2 rounded-tile bg-surface py-1.5 pl-4 pr-1.5 shadow-soft">
        <Search size={20} aria-hidden="true" className="shrink-0 text-ink-3" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${lower}`}
          aria-label={`Search ${lower}`}
          enterKeyHint="search"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
        <IconButton label={`Add a ${lower} item`} variant="fill" size={44} className={`${theme.accentBg} !rounded-bar`} onClick={() => setAdding(true)}>
          <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
        </IconButton>
      </div>

      {scanError && <p role="alert" className="rounded-row bg-danger-tile px-4 py-3 text-sm font-medium text-danger-ink">Scan failed: {scanError}</p>}

      {loading && items.length === 0 ? (
        <ListSkeleton />
      ) : grouped.length === 0 ? (
        <EmptyState icon={PackageOpen} title={search ? 'No matches' : `The ${lower} is empty`} hint={search ? 'Try a shorter word' : 'Tap + to add something, or scan a shelf'} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={({ active, over }) => { if (over && active.id !== over.id) reorder(active.id, over.id) }}>
          <SortableContext items={grouped.map(([c]) => c)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-4">
              {grouped.map(([category, rows]) => (
                <SortableCategory
                  key={category}
                  category={category}
                  items={rows}
                  theme={theme}
                  collapsed={collapsed.has(category)}
                  onToggle={() => toggle(category)}
                  dragDisabled={dragDisabled}
                  onQty={handleQty}
                  onOpen={setEditing}
                  onBuy={handleBuy}
                  onRemove={requestDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <InventoryAddSheet open={adding} location={location} theme={theme} onClose={() => setAdding(false)} onAdd={handleAdd} />
      <InventoryEditSheet item={editing} location={location} theme={theme} onClose={() => setEditing(null)} onSave={handleSave} onDelete={requestDelete} onBuy={handleBuy} />

      {results && (
        <ScanReview
          items={results.items}
          onConfirm={(confirmed, loc) => confirmItems(confirmed, loc, userId)}
          onCancel={cancelScan}
          location={location}
        />
      )}
    </div>
  )
}
