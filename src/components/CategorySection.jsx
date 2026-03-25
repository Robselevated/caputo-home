import { useState } from 'react'

export default function CategorySection({ category, items, colorClass, onUpdateQty, onDelete, onAddToGrocery, userId }) {
  const [expanded, setExpanded] = useState(false)

  const totalItems = items.length
  const zeroQtyCount = items.filter(i => i.qty === 0).length

  // Group by subcategory
  const hasSubcategories = items.some(i => i.subcategory)
  const groups = {}
  if (hasSubcategories) {
    for (const item of items) {
      const key = item.subcategory || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    }
  }

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-4 py-3 ${colorClass} rounded-2xl transition-colors`}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-heading font-semibold text-charcoal">{category}</span>
        </div>
        <div className="flex items-center gap-2">
          {zeroQtyCount > 0 && (
            <span className="bg-red-900/30 text-red-400 text-xs px-2 py-0.5 rounded-full font-medium">
              {zeroQtyCount} empty
            </span>
          )}
          <span className="text-xs text-warmgray-500 bg-dark-surface px-2 py-0.5 rounded-full">
            {totalItems}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-1 bg-dark-surface rounded-2xl border border-warmgray-100 overflow-hidden shadow-dark-sm animate-expand">
          {hasSubcategories ? (
            Object.entries(groups).map(([sub, subItems]) => (
              <div key={sub}>
                <div className="px-4 py-1.5 bg-cream text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  {sub}
                </div>
                {subItems.map(item => (
                  <InventoryItem
                    key={item.id}
                    item={item}
                    onUpdateQty={onUpdateQty}
                    onDelete={onDelete}
                    onAddToGrocery={onAddToGrocery}
                    userId={userId}
                  />
                ))}
              </div>
            ))
          ) : (
            items.map(item => (
              <InventoryItem
                key={item.id}
                item={item}
                onUpdateQty={onUpdateQty}
                onDelete={onDelete}
                onAddToGrocery={onAddToGrocery}
                userId={userId}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function InventoryItem({ item, onUpdateQty, onDelete, onAddToGrocery, userId }) {
  const [editing, setEditing] = useState(false)
  const [editQty, setEditQty] = useState(String(item.qty))

  const handleQtySubmit = () => {
    const val = parseFloat(editQty)
    if (!isNaN(val)) onUpdateQty(item.id, val, userId)
    setEditing(false)
  }

  return (
    <div className={`flex items-center gap-2 px-4 py-3 border-b border-warmgray-50 last:border-0 ${item.qty === 0 ? 'bg-red-900/20' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-charcoal text-sm">
          {item.name}
          {item.qty === 0 && (
            <span className="ml-2 text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded font-medium">OUT</span>
          )}
        </p>
        {item.notes && <p className="text-xs text-warmgray-400 truncate">{item.notes}</p>}
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onUpdateQty(item.id, item.qty - 1, userId)}
          className="w-7 h-7 rounded-lg bg-cream flex items-center justify-center text-warmgray-600 active:bg-warmgray-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        {editing ? (
          <input
            type="number"
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            onBlur={handleQtySubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleQtySubmit()}
            className="w-12 text-center text-sm font-semibold border border-warmgray-300 rounded-lg py-0.5"
            autoFocus
            inputMode="decimal"
          />
        ) : (
          <button
            onClick={() => { setEditQty(String(item.qty)); setEditing(true) }}
            className="w-12 text-center text-sm font-semibold text-charcoal"
          >
            {item.qty}
            <span className="text-[10px] text-warmgray-400 block leading-none">{item.unit}</span>
          </button>
        )}

        <button
          onClick={() => onUpdateQty(item.id, item.qty + 1, userId)}
          className="w-7 h-7 rounded-lg bg-cream flex items-center justify-center text-warmgray-600 active:bg-warmgray-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Actions */}
      <button
        onClick={() => onAddToGrocery(item, userId)}
        className="text-section-grocery shrink-0"
        title="Add to grocery list"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      </button>
      <button
        onClick={() => onDelete(item.id)}
        className="text-warmgray-300 hover:text-red-400 shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}
