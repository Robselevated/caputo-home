import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Tile } from '../../components/ui/Tile'
import { GroceryItemRow } from './GroceryItemRow'
import { storeTheme, storeLabel } from './storeTheme'

function SortableRow({ item, ...rest }) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !!item.checked })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  }
  return <GroceryItemRow item={item} sortable={item.checked ? null : { setNodeRef, listeners, style }} {...rest} />
}

// One store's tinted tile with its rows; unchecked rows reorder by press-and-hold.
export function GroceryStoreGroup({ store, items, onCheck, onQty, onOpen, onReorder }) {
  const theme = storeTheme(store)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } })
  )
  const unchecked = items.filter(i => !i.checked)

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const from = unchecked.findIndex(i => i.id === active.id)
    const to = unchecked.findIndex(i => i.id === over.id)
    if (from === -1 || to === -1) return
    onReorder(arrayMove(unchecked, from, to).map(i => i.id))
  }

  return (
    <Tile tileClass={theme.tile} inkClass={theme.ink} heading={storeLabel(store)} count={unchecked.length}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={unchecked.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {items.map(item => (
              <SortableRow key={item.id} item={item} theme={theme} onCheck={onCheck} onQty={onQty} onOpen={onOpen} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </Tile>
  )
}
