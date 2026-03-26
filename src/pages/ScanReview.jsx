import { useState } from 'react'
import { TAXONOMY, DEFAULT_UNITS, UNITS } from '../lib/constants'

const LOCATION_LABELS = {
  pantry: 'Pantry',
  freezer: 'Freezer',
  fridge: 'Fridge',
  receipt: 'List',
}

export default function ScanReview({ items, onConfirm, onCancel, location }) {
  const taxonomy = TAXONOMY[location] || {}
  const categories = Object.keys(taxonomy)

  const [editableItems, setEditableItems] = useState(
    items.map(item => ({
      ...item,
      qty: item.qty || 1,
      included: true,
      category: item.category || 'Other',
      subcategory: item.subcategory || '',
      unit: item.unit || DEFAULT_UNITS[location]?.[item.category] || 'count',
    }))
  )

  const [expandedIndex, setExpandedIndex] = useState(null)
  const [saving, setSaving] = useState(false)

  const updateItem = (index, field, value) => {
    setEditableItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleCategoryChange = (index, newCategory) => {
    setEditableItems(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        category: newCategory,
        subcategory: '',
        unit: DEFAULT_UNITS[location]?.[newCategory] || updated[index].unit,
      }
      return updated
    })
  }

  const adjustQty = (index, delta) => {
    setEditableItems(prev => {
      const updated = [...prev]
      const newQty = Math.max(1, (updated[index].qty || 1) + delta)
      updated[index] = { ...updated[index], qty: newQty }
      return updated
    })
  }

  const toggleItem = (index) => {
    setEditableItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], included: !updated[index].included }
      return updated
    })
  }

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const confirmed = editableItems.filter(i => i.included)
      await onConfirm(confirmed, location)
    } finally {
      setSaving(false)
    }
  }

  const includedCount = editableItems.filter(i => i.included).length
  const label = LOCATION_LABELS[location] || 'List'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-dark-surface w-full max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-warmgray-100 flex items-center justify-between">
          <button onClick={() => onCancel()} className="text-warmgray-400 text-sm font-medium">
            Cancel
          </button>
          <h2 className="text-base font-heading font-bold text-charcoal">Review Items</h2>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="text-section-grocery text-sm font-bold disabled:opacity-40"
          >
            {saving ? 'Saving...' : `Add to ${label}`}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {editableItems.map((item, i) => {
            const subcategories = item.category && taxonomy[item.category] ? taxonomy[item.category] : null
            const isExpanded = expandedIndex === i

            return (
              <div
                key={`${item.name}-${i}`}
                className={`card ${!item.included ? 'opacity-40' : ''} ${
                  item.needs_verification ? 'border-yellow-300 border-2' : ''
                }`}
              >
                {item.needs_verification && (
                  <div className="flex items-center gap-1.5 text-yellow-400 text-xs font-medium mb-2">
                    <span className="material-symbols-outlined text-base">warning</span>
                    {item.verification_prompt || 'Low confidence. Please verify.'}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleItem(i)}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${
                      item.included ? 'bg-section-grocery border-section-grocery' : 'border-warmgray-300'
                    }`}
                  >
                    {item.included && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(i, 'name', e.target.value)}
                      className="w-full font-medium text-sm border-b border-warmgray-200 pb-0.5 focus:outline-none focus:border-section-grocery text-charcoal bg-transparent"
                    />
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : i)}
                      className="flex items-center gap-1 mt-1 text-xs text-warmgray-400 active:text-charcoal"
                    >
                      <span>{item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}</span>
                      <span className="text-warmgray-300">{item.unit ? ` \u00b7 ${item.unit}` : ''}</span>
                      <span className="material-symbols-outlined text-sm">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => adjustQty(i, -1)}
                      className="w-7 h-7 rounded-full bg-cream flex items-center justify-center text-warmgray-600 active:bg-warmgray-200"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-charcoal">{item.qty || 1}</span>
                    <button
                      onClick={() => adjustQty(i, 1)}
                      className="w-7 h-7 rounded-full bg-cream flex items-center justify-center text-warmgray-600 active:bg-warmgray-200"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>

                {isExpanded && item.included && (
                  <div className="mt-3 pt-3 border-t border-warmgray-100 space-y-2 animate-slide-down">
                    {location !== 'receipt' && categories.length > 0 && (
                      <select
                        value={item.category}
                        onChange={(e) => handleCategoryChange(i, e.target.value)}
                        className="w-full text-xs bg-cream border border-warmgray-200 rounded-xl px-3 py-2 text-charcoal focus:outline-none focus:border-section-grocery"
                      >
                        <option value="">Select category</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    )}
                    {subcategories && (
                      <select
                        value={item.subcategory}
                        onChange={(e) => updateItem(i, 'subcategory', e.target.value)}
                        className="w-full text-xs bg-cream border border-warmgray-200 rounded-xl px-3 py-2 text-charcoal focus:outline-none focus:border-section-grocery"
                      >
                        <option value="">Subcategory (optional)</option>
                        {subcategories.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    )}
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(i, 'unit', e.target.value)}
                      className="w-full text-xs bg-cream border border-warmgray-200 rounded-xl px-3 py-2 text-charcoal focus:outline-none focus:border-section-grocery"
                    >
                      {UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-4 py-3 border-t border-warmgray-100">
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full py-3 text-sm font-bold text-white bg-section-grocery rounded-2xl active:scale-[0.98] transition-transform shadow-dark disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving {includedCount} Item{includedCount !== 1 ? 's' : ''}...
              </>
            ) : (
              `Add ${includedCount} Item${includedCount !== 1 ? 's' : ''} to ${label}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
