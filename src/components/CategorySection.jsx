import { useState } from 'react'
import { TAXONOMY, DEFAULT_UNITS } from '../lib/constants'

export default function CategorySection({ category, items, colorClass, accentColor, textColor, onUpdateQty, onEditItem, onDelete, onAddToGrocery, userId, location }) {
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
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className={`w-1 h-6 ${accentColor || 'bg-warmgray-400'} rounded-full`} />
          <h3 className="font-heading text-xl font-bold text-charcoal">{category}</h3>
        </div>
        <div className="flex items-center gap-2">
          {zeroQtyCount > 0 && (
            <span className="bg-red-50 text-red-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
              {zeroQtyCount} out
            </span>
          )}
          <span className={`${colorClass} ${textColor || ''} text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider`}>
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {hasSubcategories ? (
          Object.entries(groups).map(([sub, subItems]) => (
            <div key={sub} className="space-y-3">
              <div className="px-1 py-1">
                <span className="text-[10px] font-bold text-warmgray-500 uppercase tracking-widest">{sub}</span>
              </div>
              {subItems.map(item => (
                <InventoryItem
                  key={item.id}
                  item={item}
                  accentColor={accentColor}
                  textColor={textColor}
                  onUpdateQty={onUpdateQty}
                  onEditItem={onEditItem}
                  onDelete={onDelete}
                  onAddToGrocery={onAddToGrocery}
                  userId={userId}
                  location={location}
                />
              ))}
            </div>
          ))
        ) : (
          items.map(item => (
            <InventoryItem
              key={item.id}
              item={item}
              accentColor={accentColor}
              textColor={textColor}
              onUpdateQty={onUpdateQty}
              onEditItem={onEditItem}
              onDelete={onDelete}
              onAddToGrocery={onAddToGrocery}
              userId={userId}
              location={location}
            />
          ))
        )}
      </div>
    </div>
  )
}

function InventoryItem({ item, accentColor, textColor, onUpdateQty, onEditItem, onDelete, onAddToGrocery, userId, location }) {
  const [editing, setEditing] = useState(false)
  const [editQty, setEditQty] = useState(String(item.qty))
  const [showEdit, setShowEdit] = useState(false)
  const [editCategory, setEditCategory] = useState(item.category)
  const [editSubcategory, setEditSubcategory] = useState(item.subcategory || '')
  const [editUnit, setEditUnit] = useState(item.unit || '')
  const [editNotes, setEditNotes] = useState(item.notes || '')

  const taxonomy = TAXONOMY[location] || {}
  const categories = Object.keys(taxonomy)
  const subcategories = editCategory && taxonomy[editCategory] ? taxonomy[editCategory] : null

  const handleQtySubmit = () => {
    const val = parseFloat(editQty)
    if (!isNaN(val)) onUpdateQty(item.id, val, userId)
    setEditing(false)
  }

  const handleEditSave = () => {
    if (!onEditItem) return
    onEditItem(item.id, {
      category: editCategory,
      subcategory: editSubcategory || null,
      unit: editUnit || 'count',
      notes: editNotes || null,
    }, userId)
    setShowEdit(false)
  }

  const handleCategoryChange = (cat) => {
    setEditCategory(cat)
    setEditSubcategory('')
    setEditUnit(DEFAULT_UNITS[location]?.[cat] || item.unit || 'count')
  }

  return (
    <div>
      <div className={`bg-white p-4 rounded-lg flex items-center gap-3 editorial-shadow active:scale-[0.98] transition-transform ${item.qty === 0 ? 'ring-1 ring-red-200' : ''}`}>
        {/* Left accent bar */}
        <div className={`w-1 self-stretch ${item.qty === 0 ? 'bg-red-400' : (accentColor || 'bg-warmgray-300')} rounded-full shrink-0`} />

        {/* Item info - tap to edit */}
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => setShowEdit(!showEdit)}
        >
          <p className="font-semibold text-charcoal text-sm">
            {item.name}
            {item.qty === 0 && (
              <span className="ml-2 text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-bold uppercase">Out</span>
            )}
          </p>
          {item.notes && <p className="text-xs text-warmgray-400 truncate mt-0.5">{item.notes}</p>}
          {item.subcategory && !item.notes && (
            <p className="text-xs text-warmgray-400 mt-0.5">{item.subcategory}</p>
          )}
        </button>

        {/* Qty controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onUpdateQty(item.id, item.qty - 1, userId)}
            className="w-8 h-8 rounded-full bg-cream flex items-center justify-center text-charcoal-light hover:bg-warmgray-200 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">remove</span>
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
              className="w-10 text-center"
            >
              <span className={`text-sm font-bold ${textColor || 'text-charcoal'}`}>{item.qty}</span>
              <span className="text-[10px] text-warmgray-400 block leading-none">{item.unit}</span>
            </button>
          )}

          <button
            onClick={() => onUpdateQty(item.id, item.qty + 1, userId)}
            className={`w-8 h-8 rounded-full ${accentColor || 'bg-warmgray-400'} text-white flex items-center justify-center hover:opacity-90 transition-colors`}
          >
            <span className="material-symbols-outlined text-sm">add</span>
          </button>
        </div>

        {/* Actions */}
        <button
          onClick={() => onAddToGrocery(item, userId)}
          className="text-section-grocery shrink-0"
          title="Add to grocery list"
        >
          <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="text-warmgray-300 hover:text-red-500 shrink-0 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">delete_outline</span>
        </button>
      </div>

      {/* Edit Sheet */}
      {showEdit && (
        <div className="bg-cream border border-warmgray-200 rounded-lg p-4 mt-2 space-y-3 animate-slide-down">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-warmgray-500 uppercase tracking-wider">Edit Item</span>
            <button onClick={() => setShowEdit(false)} className="text-warmgray-400">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <select
            value={editCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full text-sm border border-warmgray-300 rounded-lg px-3 py-2 bg-white"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {subcategories && (
            <select
              value={editSubcategory}
              onChange={(e) => setEditSubcategory(e.target.value)}
              className="w-full text-sm border border-warmgray-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">No subcategory</option>
              {subcategories.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
              placeholder="Unit"
              className="flex-1 text-sm border border-warmgray-300 rounded-lg px-3 py-2"
            />
            <input
              type="text"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Notes"
              className="flex-1 text-sm border border-warmgray-300 rounded-lg px-3 py-2"
            />
          </div>
          <button
            onClick={handleEditSave}
            className={`w-full py-2 rounded-lg text-white text-sm font-semibold ${accentColor || 'bg-warmgray-500'}`}
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  )
}
