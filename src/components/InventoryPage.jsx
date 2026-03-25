import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useInventory } from '../hooks/useInventory'
import { useScanSession } from '../hooks/useScanSession'
import { TAXONOMY, DEFAULT_UNITS } from '../lib/constants'
import CategorySection from './CategorySection'
import PhotoScanner from './PhotoScanner'
import ScanReview from '../pages/ScanReview'

export default function InventoryPage({ location, title, colorClass, bgClass, lightBg, ringClass }) {
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { items, loading, addItem, updateQty, deleteItem, addToGroceryList } = useInventory(householdId, location)
  const { scanning, results, error: scanError, uploadAndScan, confirmItems, cancelScan } = useScanSession(householdId)

  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')

  // Add form
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [notes, setNotes] = useState('')

  const taxonomy = TAXONOMY[location] || {}
  const categories = Object.keys(taxonomy)

  const subcategories = category && taxonomy[category] ? taxonomy[category] : null

  // Group items by category, filtered by search
  const grouped = useMemo(() => {
    const filtered = search
      ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
      : items

    const groups = {}
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    }
    return groups
  }, [items, search])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim() || !category) return
    const defaultUnit = DEFAULT_UNITS[location]?.[category] || 'count'
    await addItem({
      name,
      qty: qty ? Number(qty) : 1,
      unit: unit || defaultUnit,
      category,
      subcategory: subcategory || null,
      notes,
      userId: user.id,
    })
    setName('')
    setQty('1')
    setUnit('')
    setCategory('')
    setSubcategory('')
    setNotes('')
    setShowAdd(false)
  }

  // Update unit default when category changes
  const handleCategoryChange = (cat) => {
    setCategory(cat)
    setSubcategory('')
    setUnit(DEFAULT_UNITS[location]?.[cat] || 'count')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`w-8 h-8 border-4 ${colorClass.replace('text-', 'border-')} border-t-transparent rounded-full animate-spin`} />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className={`text-2xl font-bold ${colorClass}`}>{title}</h1>
        <div className="flex items-center gap-2">
          <PhotoScanner
            onCapture={(file) => uploadAndScan(file, location, user.id)}
            scanning={scanning}
            colorClass={bgClass}
          />
          <button
            onClick={() => setShowAdd(!showAdd)}
            className={`w-10 h-10 ${bgClass} text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAdd ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}...`}
          className={`input-field ${ringClass}`}
        />
      </div>

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="card mb-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
            className={`input-field ${ringClass}`}
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              className={`input-field ${ringClass} w-20`}
              inputMode="decimal"
            />
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Unit"
              className={`input-field ${ringClass} flex-1`}
            />
          </div>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className={`input-field ${ringClass}`}
          >
            <option value="">Select category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {subcategories && (
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className={`input-field ${ringClass}`}
            >
              <option value="">Select subcategory (optional)</option>
              {subcategories.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className={`input-field ${ringClass}`}
          />
          <button
            type="submit"
            disabled={!name.trim() || !category}
            className={`btn-primary ${bgClass} w-full disabled:opacity-40`}
          >
            Add Item
          </button>
        </form>
      )}

      {/* Categories */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="font-medium">
            {search ? 'No items match your search' : `${title} is empty`}
          </p>
          {!search && <p className="text-sm mt-1">Tap + to add items</p>}
        </div>
      ) : (
        categories.map(cat => {
          if (!grouped[cat]) return null
          return (
            <CategorySection
              key={cat}
              category={cat}
              items={grouped[cat]}
              colorClass={lightBg}
              onUpdateQty={updateQty}
              onDelete={deleteItem}
              onAddToGrocery={addToGroceryList}
              userId={user.id}
            />
          )
        })
      )}

      {/* Scan Error */}
      {scanError && (
        <div className="card bg-red-50 border-red-200 text-red-600 text-sm mb-4">
          Scan failed: {scanError}
        </div>
      )}

      {/* Scan Review Modal */}
      {results && (
        <ScanReview
          items={results.items}
          onConfirm={(confirmed, loc) => confirmItems(confirmed, loc, user.id)}
          onCancel={cancelScan}
          location={location}
        />
      )}
    </div>
  )
}
