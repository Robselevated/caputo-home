import { useState, useMemo, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useGroceryList } from '../hooks/useGroceryList'
import { useRecentlyBought } from '../hooks/useRecentlyBought'
import { useItemHistory } from '../hooks/useItemHistory'
import { useScanSession } from '../hooks/useScanSession'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useOfflineSync } from '../hooks/useOfflineSync'
import ItemAutocomplete from '../components/ItemAutocomplete'
import PhotoScanner from '../components/PhotoScanner'
import ScanReview from './ScanReview'
import OfflineIndicator from '../components/OfflineIndicator'
import { STORES, UNITS, getDefaultStore } from '../lib/constants'

// Store accent colors for left bar + badges
const storeAccentColors = {
  "Pilgrim's": { bar: 'bg-section-grocery', badge: 'bg-section-grocery/10 text-section-grocery', text: 'text-section-grocery' },
  'Pilgrams': { bar: 'bg-section-grocery', badge: 'bg-section-grocery/10 text-section-grocery', text: 'text-section-grocery' },
  'Costco': { bar: 'bg-section-freezer', badge: 'bg-section-freezer/10 text-section-freezer', text: 'text-section-freezer' },
  'Grocery Store': { bar: 'bg-section-cookbook', badge: 'bg-section-cookbook/10 text-section-cookbook', text: 'text-section-cookbook' },
  'Store': { bar: 'bg-section-cookbook', badge: 'bg-section-cookbook/10 text-section-cookbook', text: 'text-section-cookbook' },
}

const defaultAccent = { bar: 'bg-warmgray-400', badge: 'bg-warmgray-100 text-warmgray-500', text: 'text-warmgray-500' }

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateLabel(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.getTime() === today.getTime()) return 'Today'
  if (date.getTime() === yesterday.getTime()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function GroceryList() {
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { items, loading, addItem, checkItem, deleteItem, updateItem, clearChecked } = useGroceryList(householdId)
  const { items: recentItems, addBackToList } = useRecentlyBought(householdId)
  const { getSuggestions } = useItemHistory(householdId)
  const { scanning, results, error: scanError, uploadAndScan, confirmItems, cancelScan } = useScanSession(householdId)
  const { permission, requestPermission, sendPushNotification } = usePushNotifications(user?.id)
  const { isOnline, pendingCount, syncing, syncNow } = useOfflineSync(householdId)

  const [showAddForm, setShowAddForm] = useState(false)
  const [showRecentHistory, setShowRecentHistory] = useState(false)
  const [storeFilter, setStoreFilter] = useState(null)
  const [openStoreSwitcher, setOpenStoreSwitcher] = useState(null)
  const [expandedDays, setExpandedDays] = useState({})
  const storeSwitcherRef = useRef(null)

  // Add form state
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [store, setStore] = useState('')
  const [notes, setNotes] = useState('')
  const [userOverrodeStore, setUserOverrodeStore] = useState(false)

  // Request push notification permission on first load
  useEffect(() => {
    if (permission === 'default') requestPermission()
  }, [permission])

  // Close store switcher on outside tap
  useEffect(() => {
    if (!openStoreSwitcher) return
    const handler = (e) => {
      if (storeSwitcherRef.current && !storeSwitcherRef.current.contains(e.target)) {
        setOpenStoreSwitcher(null)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [openStoreSwitcher])

  // Auto-select store when item name changes
  useEffect(() => {
    if (!userOverrodeStore && name.trim().length >= 2) {
      setStore(getDefaultStore(name))
    }
  }, [name, userOverrodeStore])

  // Group items by store
  const grouped = useMemo(() => {
    const groups = {}
    const filtered = storeFilter ? items.filter(i => i.store === storeFilter) : items

    for (const item of filtered) {
      const key = item.store || 'No Store'
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    }

    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1
        return new Date(a.created_at) - new Date(b.created_at)
      })
    }

    return groups
  }, [items, storeFilter])

  // Recently bought: 14-day filter, group by day, consolidate duplicates
  const recentByDay = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    cutoff.setHours(0, 0, 0, 0)

    const filtered = recentItems.filter(item => new Date(item.bought_at) >= cutoff)

    const dayGroups = {}
    for (const item of filtered) {
      const dateKey = new Date(item.bought_at).toISOString().split('T')[0]
      if (!dayGroups[dateKey]) dayGroups[dateKey] = []
      dayGroups[dateKey].push(item)
    }

    const consolidated = {}
    for (const [dateKey, dayItems] of Object.entries(dayGroups)) {
      const byName = {}
      for (const item of dayItems) {
        const key = item.name.toLowerCase()
        if (byName[key]) {
          byName[key].totalQty += (item.qty || 1)
          byName[key].entries.push(item)
        } else {
          byName[key] = { ...item, totalQty: item.qty || 1, entries: [item] }
        }
      }
      consolidated[dateKey] = Object.values(byName)
    }

    return Object.entries(consolidated).sort(([a], [b]) => b.localeCompare(a))
  }, [recentItems])

  // Flat recent items for carousel (most recent first, max 8)
  const recentCarousel = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    return recentItems
      .filter(item => new Date(item.bought_at) >= cutoff)
      .slice(0, 8)
  }, [recentItems])

  // Initialize first day as expanded
  useEffect(() => {
    if (recentByDay.length > 0 && Object.keys(expandedDays).length === 0) {
      setExpandedDays({ [recentByDay[0][0]]: true })
    }
  }, [recentByDay])

  const toggleDay = (dateKey) => {
    setExpandedDays(prev => ({ ...prev, [dateKey]: !prev[dateKey] }))
  }

  const handleAdjustQty = async (item, delta) => {
    const newQty = Math.max(1, (item.qty || 1) + delta)
    await updateItem(item.id, { qty: newQty }, user.id)
  }

  const handleStoreChange = async (item, newStore) => {
    await updateItem(item.id, { store: newStore }, user.id)
    setOpenStoreSwitcher(null)
  }

  const handleQuickAdd = async () => {
    if (!name.trim()) return
    await addItem({ name, qty: qty ? Number(qty) : 1, unit, store: store || 'Grocery Store', notes, userId: user.id })
    sendPushNotification(householdId, user.id, `${profile?.name || 'Someone'} added ${name} to the grocery list`)
    setName('')
    setQty('')
    setUnit('')
    setStore('')
    setNotes('')
    setUserOverrodeStore(false)
    setShowAddForm(false)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    await handleQuickAdd()
  }

  const handleCheck = async (item) => {
    await checkItem(item, user.id)
    sendPushNotification(householdId, user.id, `${profile?.name || 'Someone'} checked off ${item.name}`)
  }

  const handleAddBack = async (item) => {
    await addBackToList(item, user.id)
  }

  const checkedCount = items.filter(i => i.checked).length
  const totalCount = items.length
  const allStores = [...new Set(items.map(i => i.store || 'No Store'))]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-section-grocery border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} syncing={syncing} onSync={syncNow} />

      <div className="px-6">
        {/* Hero Section */}
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-heading text-3xl font-extrabold text-charcoal">Grocery List</h2>
            <span className="text-sm font-medium text-section-grocery">{totalCount} Item{totalCount !== 1 ? 's' : ''} Total</span>
          </div>
          <p className="text-charcoal-light leading-relaxed text-sm">Your curated household essentials, organized for efficiency.</p>
        </section>

        {/* Search / Add Quick Action */}
        <div className="mb-10">
          <div className="bg-cream rounded-xl p-1 flex items-center gap-2">
            <div className="flex-1 flex items-center px-4 py-3 gap-3">
              <span className="material-symbols-outlined text-warmgray-400">search</span>
              <ItemAutocomplete
                value={name}
                onChange={(val) => {
                  setName(val)
                  setUserOverrodeStore(false)
                }}
                suggestions={getSuggestions}
                placeholder="Add milk, eggs, bread..."
                className="bg-transparent border-none focus:ring-0 w-full placeholder:text-warmgray-400 p-0 text-charcoal"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <PhotoScanner
                onCapture={(file) => uploadAndScan(file, 'receipt', user.id)}
                scanning={scanning}
                colorClass="bg-section-grocery"
              />
              <button
                onClick={() => {
                  if (name.trim() && !showAddForm) {
                    handleQuickAdd()
                  } else {
                    setShowAddForm(!showAddForm)
                  }
                }}
                className="bg-section-grocery text-white w-12 h-12 rounded-lg flex items-center justify-center shadow-dark-md active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined">{showAddForm ? 'close' : 'add'}</span>
              </button>
            </div>
          </div>

          {/* Expanded Add Form */}
          {showAddForm && (
            <form onSubmit={handleAdd} className="mt-3 bg-dark-surface rounded-xl p-4 space-y-3 editorial-shadow animate-slide-down border border-warmgray-100">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="Qty"
                  className="input-field focus:ring-section-grocery w-20"
                  inputMode="decimal"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="input-field focus:ring-section-grocery flex-1"
                >
                  <option value="">Unit</option>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex gap-2 flex-wrap">
                {STORES.map(s => {
                  const accent = storeAccentColors[s] || defaultAccent
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setStore(store === s ? '' : s)
                        setUserOverrodeStore(true)
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        store === s ? `${accent.bar} text-white` : 'bg-cream text-warmgray-600'
                      }`}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (substitutions, reminders...)"
                className="input-field focus:ring-section-grocery"
              />
              <button
                type="submit"
                disabled={!name.trim()}
                className="btn-primary bg-section-grocery hover:bg-olive-dark w-full disabled:opacity-40"
              >
                Add to List
              </button>
            </form>
          )}
        </div>

        {/* Store Filter Pills */}
        {allStores.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setStoreFilter(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 transition-colors ${
                !storeFilter ? 'bg-section-grocery text-white shadow-sm' : 'bg-white border border-warmgray-200 text-warmgray-500 editorial-shadow'
              }`}
            >
              All Items
            </button>
            {allStores.map(s => {
              const accent = storeAccentColors[s] || defaultAccent
              return (
                <button
                  key={s}
                  onClick={() => setStoreFilter(storeFilter === s ? null : s)}
                  className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 transition-colors ${
                    storeFilter === s
                      ? `${accent.bar} text-white shadow-sm`
                      : 'bg-white border border-warmgray-200 text-warmgray-500 editorial-shadow'
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        )}

        {/* Store Groups */}
        <div className="space-y-8">
          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16 text-warmgray-400">
              <span className="material-symbols-outlined text-6xl mb-3 opacity-50 block animate-float">shopping_cart</span>
              <p className="font-medium text-charcoal-light">List is empty</p>
              <p className="text-sm mt-1">Type an item above and tap + to add</p>
            </div>
          ) : (
            Object.entries(grouped).map(([storeName, storeItems]) => {
              const accent = storeAccentColors[storeName] || defaultAccent
              const uncheckedCount = storeItems.filter(i => !i.checked).length
              return (
                <section key={storeName}>
                  {/* Store Header */}
                  <div className="flex items-center gap-2 mb-4 ml-1">
                    <div className={`w-1 h-6 ${accent.bar} rounded-full`} />
                    <h3 className="font-heading text-xl font-bold text-charcoal">{storeName}</h3>
                    <span className={`${accent.badge} text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-auto`}>
                      {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Item Cards */}
                  <div className="space-y-3">
                    {storeItems.map(item => (
                      <div
                        key={item.id}
                        className={`bg-dark-surface p-5 rounded-lg flex items-center gap-4 active:scale-[0.98] transition-all editorial-shadow ${
                          item.checked ? 'opacity-40' : ''
                        }`}
                      >
                        {/* Left Accent Bar */}
                        <div className={`w-1 self-stretch ${accent.bar} rounded-full shrink-0`} />

                        {/* Checkbox */}
                        <button
                          onClick={() => handleCheck(item)}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                            item.checked
                              ? 'bg-section-grocery border-section-grocery animate-check-off'
                              : 'border-warmgray-200 hover:border-section-grocery/30'
                          }`}
                        >
                          {item.checked && (
                            <span className="material-symbols-outlined text-white text-sm">check</span>
                          )}
                        </button>

                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold ${item.checked ? 'line-through text-warmgray-400' : 'text-charcoal'}`}>
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.unit && (
                              <span className="text-xs text-charcoal-light font-medium">{item.unit}</span>
                            )}
                            {item.notes && (
                              <span className="text-xs text-warmgray-400 truncate">{item.notes}</span>
                            )}
                            {/* Store Switcher */}
                            <div className="relative" ref={openStoreSwitcher === item.id ? storeSwitcherRef : null}>
                              <button
                                onClick={() => setOpenStoreSwitcher(openStoreSwitcher === item.id ? null : item.id)}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${accent.badge}`}
                              >
                                {item.store || 'No Store'}
                              </button>
                              {openStoreSwitcher === item.id && (
                                <div className="absolute left-0 top-full mt-1 bg-dark-surface border border-warmgray-100 rounded-xl shadow-dark-md z-20 overflow-hidden min-w-[140px]">
                                  {STORES.map(s => {
                                    const sAccent = storeAccentColors[s] || defaultAccent
                                    return (
                                      <button
                                        key={s}
                                        onClick={() => handleStoreChange(item, s)}
                                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                          item.store === s ? 'bg-warmgray-50' : ''
                                        } active:bg-warmgray-50`}
                                      >
                                        <span className={`w-2 h-2 rounded-full ${sAccent.bar}`} />
                                        <span className="text-charcoal">{s}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Qty Controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleAdjustQty(item, -1)}
                            className="w-8 h-8 rounded-full bg-cream flex items-center justify-center text-charcoal-light hover:bg-warmgray-200 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">remove</span>
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-charcoal">{item.qty || 1}</span>
                          <button
                            onClick={() => handleAdjustQty(item, 1)}
                            className="w-8 h-8 rounded-full bg-section-grocery text-white flex items-center justify-center hover:opacity-90 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                          </button>
                        </div>

                        {/* More / Delete */}
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-warmgray-300 hover:text-red-500 shrink-0 transition-colors"
                        >
                          <span className="material-symbols-outlined">more_vert</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })
          )}

          {/* Clear Checked */}
          {checkedCount > 0 && (
            <button
              onClick={() => clearChecked(user.id)}
              className="w-full py-3 text-sm font-medium text-red-600 bg-red-50 rounded-xl editorial-shadow"
            >
              Clear {checkedCount} checked item{checkedCount !== 1 ? 's' : ''}
            </button>
          )}

          {/* Recently Bought Section */}
          {recentCarousel.length > 0 && !showRecentHistory && (
            <section className="mt-12">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-lg font-bold text-charcoal">Recently Bought</h3>
                <button
                  onClick={() => setShowRecentHistory(true)}
                  className="text-section-grocery text-sm font-semibold"
                >
                  View History
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
                {recentCarousel.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleAddBack(item)}
                    className="flex-shrink-0 w-32 bg-white p-4 rounded-lg flex flex-col items-center text-center active:scale-95 transition-transform editorial-shadow"
                  >
                    <div className="w-12 h-12 bg-dark-surface rounded-full flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-section-grocery">shopping_basket</span>
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-tighter text-charcoal-light">{item.name}</p>
                    <p className="text-[10px] text-warmgray-400 mt-0.5">{formatRelativeTime(item.bought_at)}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Recently Bought Expanded History */}
          {showRecentHistory && (
            <section className="mt-12">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-lg font-bold text-charcoal">Recently Bought</h3>
                <button
                  onClick={() => setShowRecentHistory(false)}
                  className="text-section-grocery text-sm font-semibold"
                >
                  Hide History
                </button>
              </div>

              {recentByDay.length === 0 ? (
                <div className="text-center py-12 text-warmgray-400">
                  <p className="font-medium text-charcoal-light">No recent purchases</p>
                  <p className="text-sm mt-1">Items you check off will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentByDay.map(([dateKey, dayItems]) => {
                    const isExpanded = expandedDays[dateKey]
                    return (
                      <div key={dateKey}>
                        <button
                          onClick={() => toggleDay(dateKey)}
                          className="w-full flex items-center justify-between px-4 py-2.5 bg-white rounded-xl text-sm font-medium text-charcoal active:bg-warmgray-100 transition-colors editorial-shadow"
                        >
                          <span className="font-heading">{formatDateLabel(dateKey)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-warmgray-400">{dayItems.length} item{dayItems.length !== 1 ? 's' : ''}</span>
                            <span className={`material-symbols-outlined text-warmgray-400 text-lg transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                              expand_more
                            </span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="mt-2 space-y-2">
                            {dayItems.map(item => {
                              const accent = storeAccentColors[item.store] || defaultAccent
                              return (
                                <div key={item.id} className="bg-white rounded-lg p-4 flex items-center gap-3 editorial-shadow">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-charcoal text-sm">
                                      {item.name}
                                      {item.totalQty > 1 && (
                                        <span className="text-warmgray-400 font-normal ml-1">x{item.totalQty}</span>
                                      )}
                                      {item.unit && (
                                        <span className="text-warmgray-400 font-normal text-xs ml-1">{item.unit}</span>
                                      )}
                                    </p>
                                    {item.store && (
                                      <span className={`text-xs font-medium ${accent.text}`}>{item.store}</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleAddBack(item)}
                                    className="text-section-grocery font-medium text-xs shrink-0 px-3 py-1.5 bg-section-grocery/10 rounded-lg active:scale-95 transition-transform"
                                  >
                                    + Add Back
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Scan Error */}
        {scanError && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm mt-4 editorial-shadow">
            Scan failed: {scanError}
          </div>
        )}
      </div>

      {/* Scan Review Modal */}
      {results && (
        <ScanReview
          items={results.items}
          onConfirm={(confirmed, loc) => confirmItems(confirmed, loc, user.id)}
          onCancel={cancelScan}
          location="receipt"
        />
      )}
    </div>
  )
}
