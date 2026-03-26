import { useState, useMemo } from 'react'
import { TAXONOMY, DEFAULT_UNITS, UNITS, SECTION_COLORS } from '../lib/constants'
import { supabase } from '../lib/supabase'

const LOCATIONS = ['fridge', 'freezer', 'pantry']

const LOCATION_LABELS = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
}

const LOCATION_ICONS = {
  fridge: 'kitchen',
  freezer: 'ac_unit',
  pantry: 'shelves',
}

export default function ReceiptReview({ items, onConfirm, onCancel, householdId }) {
  const [editableItems, setEditableItems] = useState(
    items.map(item => ({
      ...item,
      qty: item.qty || 1,
      included: true,
      location: item.location || 'pantry',
      category: item.category || 'Other',
      subcategory: item.subcategory || '',
      unit: item.unit || DEFAULT_UNITS[item.location || 'pantry']?.[item.category] || 'count',
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

  const handleLocationChange = (index, newLocation) => {
    setEditableItems(prev => {
      const updated = [...prev]
      const taxonomy = TAXONOMY[newLocation] || {}
      const categories = Object.keys(taxonomy)
      const newCategory = categories[0] || 'Other'
      updated[index] = {
        ...updated[index],
        location: newLocation,
        category: newCategory,
        subcategory: '',
        unit: DEFAULT_UNITS[newLocation]?.[newCategory] || updated[index].unit,
      }
      return updated
    })
  }

  const handleCategoryChange = (index, newCategory) => {
    setEditableItems(prev => {
      const updated = [...prev]
      const loc = updated[index].location
      updated[index] = {
        ...updated[index],
        category: newCategory,
        subcategory: '',
        unit: DEFAULT_UNITS[loc]?.[newCategory] || updated[index].unit,
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

  // Group items by location for display
  const grouped = useMemo(() => {
    const groups = {}
    editableItems.forEach((item, index) => {
      const loc = item.location || 'pantry'
      if (!groups[loc]) groups[loc] = []
      groups[loc].push({ ...item, _index: index })
    })
    return groups
  }, [editableItems])

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const confirmed = editableItems.filter(i => i.included)

      // Group confirmed items by location and call onConfirm per group
      const byLocation = {}
      for (const item of confirmed) {
        const loc = item.location || 'pantry'
        if (!byLocation[loc]) byLocation[loc] = []
        byLocation[loc].push(item)
      }

      for (const [loc, locItems] of Object.entries(byLocation)) {
        await onConfirm(locItems, loc)
      }

      // Auto-remove matching items from grocery list
      const names = confirmed.map(i => i.name.toLowerCase())
      if (names.length > 0 && householdId) {
        const { data: groceryMatches } = await supabase
          .from('grocery_items')
          .select('id, name')
          .eq('household_id', householdId)

        if (groceryMatches) {
          const toDelete = groceryMatches.filter(g =>
            names.includes(g.name.toLowerCase())
          )
          for (const match of toDelete) {
            await supabase.from('grocery_items').delete().eq('id', match.id)
          }
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const includedCount = editableItems.filter(i => i.included).length

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-dark-surface w-full max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-warmgray-100 flex items-center justify-between">
          <button onClick={() => onCancel()} className="text-warmgray-400 text-sm font-medium">
            Cancel
          </button>
          <h2 className="text-base font-heading font-bold text-charcoal">Receipt Items</h2>
          <button
            onClick={handleConfirm}
            disabled={saving || includedCount === 0}
            className="text-section-grocery text-sm font-bold disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Add All'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {LOCATIONS.map(loc => {
            const locItems = grouped[loc]
            if (!locItems || locItems.length === 0) return null
            const colors = SECTION_COLORS[loc]
            const taxonomy = TAXONOMY[loc] || {}
            const categories = Object.keys(taxonomy)

            return (
              <section key={loc}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-1 h-5 ${colors.bg} rounded-full`} />
                  <span className={`material-symbols-outlined text-lg ${colors.text}`}>{LOCATION_ICONS[loc]}</span>
                  <h3 className="font-heading font-bold text-charcoal">{LOCATION_LABELS[loc]}</h3>
                  <span className={`${colors.light} ${colors.text} text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-auto`}>
                    {locItems.filter(i => i.included).length} item{locItems.filter(i => i.included).length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-2">
                  {locItems.map(item => {
                    const i = item._index
                    const isExpanded = expandedIndex === i
                    const itemTaxonomy = TAXONOMY[item.location] || {}
                    const itemCategories = Object.keys(itemTaxonomy)
                    const subcategories = item.category && itemTaxonomy[item.category] ? itemTaxonomy[item.category] : null

                    return (
                      <div
                        key={`${item.name}-${i}`}
                        className={`bg-white p-3 rounded-lg editorial-shadow ${!item.included ? 'opacity-40' : ''} ${
                          item.needs_verification ? 'border-yellow-300 border-2' : ''
                        }`}
                      >
                        {item.needs_verification && (
                          <div className="flex items-center gap-1.5 text-yellow-500 text-xs font-medium mb-2">
                            <span className="material-symbols-outlined text-base">warning</span>
                            {item.verification_prompt || 'Unsure about placement. Please verify.'}
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleItem(i)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                              item.included ? `${colors.bg} ${colors.border}` : 'border-warmgray-300'
                            }`}
                          >
                            {item.included && (
                              <span className="material-symbols-outlined text-white text-sm">check</span>
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
                              <span className="material-symbols-outlined text-sm">remove</span>
                            </button>
                            <span className="w-7 text-center text-sm font-bold text-charcoal">{item.qty || 1}</span>
                            <button
                              onClick={() => adjustQty(i, 1)}
                              className="w-7 h-7 rounded-full bg-cream flex items-center justify-center text-warmgray-600 active:bg-warmgray-200"
                            >
                              <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                          </div>
                        </div>

                        {isExpanded && item.included && (
                          <div className="mt-3 pt-3 border-t border-warmgray-100 space-y-2 animate-slide-down">
                            {/* Location picker */}
                            <div className="flex gap-2">
                              {LOCATIONS.map(l => {
                                const lColors = SECTION_COLORS[l]
                                return (
                                  <button
                                    key={l}
                                    onClick={() => handleLocationChange(i, l)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                                      item.location === l
                                        ? `${lColors.bg} text-white`
                                        : 'bg-cream text-warmgray-500'
                                    }`}
                                  >
                                    {LOCATION_LABELS[l]}
                                  </button>
                                )
                              })}
                            </div>

                            {/* Category */}
                            {itemCategories.length > 0 && (
                              <select
                                value={item.category}
                                onChange={(e) => handleCategoryChange(i, e.target.value)}
                                className="w-full text-xs bg-cream border border-warmgray-200 rounded-xl px-3 py-2 text-charcoal focus:outline-none focus:border-section-grocery"
                              >
                                <option value="">Select category</option>
                                {itemCategories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            )}

                            {/* Subcategory */}
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

                            {/* Unit */}
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
              </section>
            )
          })}
        </div>

        <div className="px-4 py-3 border-t border-warmgray-100">
          <button
            onClick={handleConfirm}
            disabled={saving || includedCount === 0}
            className="w-full py-3 text-sm font-bold text-white bg-section-grocery rounded-2xl active:scale-[0.98] transition-transform shadow-dark disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Adding {includedCount} Item{includedCount !== 1 ? 's' : ''} to Inventory...
              </>
            ) : (
              `Add ${includedCount} Item${includedCount !== 1 ? 's' : ''} to Inventory`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
