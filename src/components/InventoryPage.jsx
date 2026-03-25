import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useInventory } from '../hooks/useInventory'
import { useScanSession } from '../hooks/useScanSession'
import { TAXONOMY, DEFAULT_UNITS } from '../lib/constants'
import CategorySection from './CategorySection'
import PhotoScanner from './PhotoScanner'
import ScanReview from '../pages/ScanReview'

export default function InventoryPage({
  location, title, colorClass, bgClass, lightBg, ringClass,
  heroLabel, heroAccentWord, heroSubtitle, heroShowStat,
  heroTitleInColor, gutterClass, sectionIcon,
}) {
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { items, loading, addItem, updateQty, deleteItem, addToGroceryList } = useInventory(householdId, location)
  const { scanning, results, error: scanError, uploadAndScan, confirmItems, cancelScan } = useScanSession(householdId)

  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(null)

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

  // Group items by category, filtered by search + category filter
  const grouped = useMemo(() => {
    let filtered = items
    if (search) {
      filtered = filtered.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    }
    if (categoryFilter) {
      filtered = filtered.filter(i => i.category === categoryFilter)
    }
    const groups = {}
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    }
    return groups
  }, [items, search, categoryFilter])

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

  // Build title display
  const titleBase = heroAccentWord ? title.replace(heroAccentWord, '').trim() : title

  return (
    <div className="px-6 space-y-8">

      {/* Hero Section */}
      <section className="space-y-2">
        {heroLabel && (
          <p className={`${colorClass} font-semibold tracking-wider uppercase text-xs`}>{heroLabel}</p>
        )}
        <div className="flex items-baseline justify-between">
          <h2 className={`font-heading text-4xl font-extrabold tracking-tight ${gutterClass || ''} ${heroTitleInColor ? colorClass : 'text-charcoal'}`}>
            {heroAccentWord ? (
              <>{titleBase} <span className={colorClass}>{heroAccentWord}</span></>
            ) : title}
          </h2>
          {heroShowStat && (
            <span className={`text-sm font-medium ${colorClass}`}>
              {items.length} Item{items.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {heroSubtitle && (
          <p className="text-charcoal-light text-sm max-w-[80%] leading-relaxed">{heroSubtitle}</p>
        )}
      </section>

      {/* Search & Add Bento */}
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-3 bg-cream rounded-xl p-4 flex items-center gap-3 editorial-shadow">
          <span className={`material-symbols-outlined ${colorClass}`}>search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="bg-transparent border-none focus:ring-0 p-0 text-sm font-medium placeholder:text-warmgray-300 w-full text-charcoal"
          />
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className={`col-span-1 ${bgClass} rounded-xl flex items-center justify-center text-white shadow-dark-md active:scale-95 transition-transform`}
        >
          <span className="material-symbols-outlined">{showAdd ? 'close' : 'add'}</span>
        </button>
      </div>

      {/* Category Filter Pills */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-6 px-6">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`px-5 py-2.5 rounded-full text-sm font-medium shrink-0 transition-colors ${
              !categoryFilter
                ? `${bgClass} text-white editorial-shadow`
                : 'bg-white border border-warmgray-200 text-warmgray-500 editorial-shadow'
            }`}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium shrink-0 transition-colors ${
                categoryFilter === cat
                  ? `${bgClass} text-white editorial-shadow`
                  : 'bg-white border border-warmgray-200 text-warmgray-500 editorial-shadow'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-dark-surface rounded-xl p-4 space-y-3 border border-warmgray-100 editorial-shadow animate-slide-down">
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
        <div className="text-center py-16 text-warmgray-400">
          <span className="material-symbols-outlined text-6xl mb-3 opacity-50 block animate-float">
            {sectionIcon || 'inventory_2'}
          </span>
          <p className="font-medium text-charcoal-light">
            {search || categoryFilter ? 'No items match your filters' : `${title} is empty`}
          </p>
          {!search && !categoryFilter && <p className="text-sm mt-1">Tap + to add items</p>}
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map(cat => {
            if (!grouped[cat]) return null
            return (
              <CategorySection
                key={cat}
                category={cat}
                items={grouped[cat]}
                colorClass={lightBg}
                accentColor={bgClass}
                textColor={colorClass}
                onUpdateQty={updateQty}
                onDelete={deleteItem}
                onAddToGrocery={addToGroceryList}
                userId={user.id}
              />
            )
          })}
        </div>
      )}

      {/* Scan Error */}
      {scanError && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm">
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

      {/* FAB: Photo Scanner */}
      {!showAdd && (
        <div className="fixed bottom-24 right-6 z-40">
          <PhotoScanner
            onCapture={(file) => uploadAndScan(file, location, user.id)}
            scanning={scanning}
            colorClass={bgClass}
          />
        </div>
      )}
    </div>
  )
}
