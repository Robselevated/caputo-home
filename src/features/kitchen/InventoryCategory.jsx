import { useMemo } from 'react'
import { Tile } from '../../components/ui/Tile'
import { InventoryItemRow } from './InventoryItemRow'

// One category's tinted tile. Items with subcategories group under small
// labels; the heading collapses the tile and is the drag activator for
// reordering categories.
export function InventoryCategory({ category, items, theme, collapsed, onToggle, dragHandleProps, onQty, onOpen, onBuy, onRemove }) {
  const { groups, outCount } = useMemo(() => {
    const outCount = items.filter(i => i.qty === 0).length
    if (!items.some(i => i.subcategory)) return { groups: null, outCount }
    const map = new Map()
    for (const item of items) {
      const key = item.subcategory || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    return { groups: [...map.entries()], outCount }
  }, [items])

  const count = (
    <>
      {outCount > 0 && <span className="mr-1 rounded-full bg-danger-tile px-2 py-0.5 text-[11px] font-bold text-danger-ink">{outCount} out</span>}
      {items.length}
    </>
  )
  const row = (item) => <InventoryItemRow key={item.id} item={item} theme={theme} onQty={onQty} onOpen={onOpen} onBuy={onBuy} onRemove={onRemove} />

  return (
    <Tile tileClass={theme.tile} inkClass={theme.ink} heading={category} count={count} collapsed={collapsed} onToggle={onToggle} headingProps={dragHandleProps}>
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
