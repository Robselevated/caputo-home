import { useMemo } from 'react'
import { Tile } from '../../components/ui/Tile'
import { InventoryItemRow } from './InventoryItemRow'

// One category's tinted tile. Items with subcategories group under small
// labels; the heading collapses the tile and is the drag activator for
// reordering categories.
export function InventoryCategory({ category, items, theme, collapsed, onToggle, dragHandleProps, onQty, onOpen }) {
  const groups = useMemo(() => {
    if (!items.some(i => i.subcategory)) return null
    const map = new Map()
    for (const item of items) {
      const key = item.subcategory || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    return [...map.entries()]
  }, [items])

  const row = (item) => <InventoryItemRow key={item.id} item={item} theme={theme} onQty={onQty} onOpen={onOpen} />

  return (
    <Tile tileClass={theme.tile} inkClass={theme.ink} heading={category} count={items.length} collapsed={collapsed} onToggle={onToggle} headingProps={dragHandleProps}>
      <div className="flex flex-col gap-1.5">
        {groups
          ? groups.map(([sub, rows]) => (
              <div key={sub} className="flex flex-col gap-1.5">
                <p className={`px-1.5 pt-1 text-[12px] font-semibold ${theme.ink}`}>{sub}</p>
                {rows.map(row)}
              </div>
            ))
          : items.map(row)}
      </div>
    </Tile>
  )
}
