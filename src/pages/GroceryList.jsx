import { useState, useMemo, useEffect } from 'react'
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
import { STORES, UNITS } from '../lib/constants'

const TABS = ['List', 'Recently Bought']

export default function GroceryList() {
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { items, loading, addItem, checkItem, deleteItem, updateItem, clearChecked } = useGroceryList(householdId)
  const { items: recentItems, addBackToList } = useRecentlyBought(householdId)
  const { getSuggestions } = useItemHistory(householdId)
  const { scanning, results, error: scanError, uploadAndScan, confirmItems, cancelScan } = useScanSession(householdId)
  const { permission, requestPermission, sendPushNotification } = usePushNotifications(user?.id)
  const { isOnline, pendingCount, syncing, syncNow } = useOfflineSync(householdId)

  const [activeTab, setActiveTab] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [storeFilter, setStoreFilter] = useState(null)

  // Request push notification permission on first load
  useEffect(() => {
    if (permission === 'default') {
      requestPermission()
    }
  }, [permission])

  // Add form state
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [store, setStore] = useState('')
  const [notes, setNotes] = useState('')

  // Group items by store
  const grouped = useMemo(() => {
    const groups = {}
    const filtered = storeFilter
      ? items.filter(i => i.store === storeFilter)
      : items

    for (const item of filtered) {
      const key = item.store || 'No Store'
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    }

    // Sort: unchecked first within each group
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1
        return new Date(a.created_at) - new Date(b.created_at)
      })
    }

    return groups
  }, [items, storeFilter])

  const storeColors = {
    'Pilgrams': 'bg-emerald-600',
    'Costco': 'bg-red-600',
    'Store': 'bg-section-freezer',
  }

  const handleAdjustQty = async (item, delta) => {
    const newQty = Math.max(1, (item.qty || 1) + delta)
    await updateItem(item.id, { qty: newQty }, user.id)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    await addItem({ name, qty: qty ? Number(qty) : 1, unit, store, notes, userId: user.id })
    sendPushNotification(householdId, user.id, `${profile?.name || 'Someone'} added ${name} to the grocery list`)
    setName('')
    setQty('')
    setUnit('')
    setStore('')
    setNotes('')
    setShowAdd(false)
  }

  const handleCheck = async (item) => {
    await checkItem(item, user.id)
    sendPushNotification(householdId, user.id, `${profile?.name || 'Someone'} checked off ${item.name}`)
  }

  const handleAddBack = async (item) => {
    await addBackToList(item, user.id)
  }

  const checkedCount = items.filter(i => i.checked).length
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

      <div className="px-4 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-heading font-bold text-section-grocery">Grocery List</h1>
        <div className="flex items-center gap-2">
          <PhotoScanner
            onCapture={(file) => uploadAndScan(file, 'receipt', user.id)}
            scanning={scanning}
            colorClass="bg-section-grocery"
          />
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="w-10 h-10 bg-section-grocery text-white rounded-full flex items-center justify-center shadow-dark active:scale-95 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAdd ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-cream rounded-2xl p-1 mb-4">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${
              activeTab === i ? 'bg-dark-surface text-section-grocery shadow-dark-sm' : 'text-warmgray-500'
            }`}
          >
            {tab}
            {i === 1 && recentItems.length > 0 && (
              <span className="ml-1 text-xs bg-warmgray-100 px-1.5 py-0.5 rounded-full">
                {recentItems.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="card mb-4 space-y-3 animate-slide-down">
          <ItemAutocomplete
            value={name}
            onChange={setName}
            suggestions={getSuggestions}
            placeholder="Item name"
          />
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
            {STORES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStore(store === s ? '' : s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  store === s
                    ? `${storeColors[s] || 'bg-warmgray-500'} text-white`
                    : 'bg-cream text-warmgray-600'
                }`}
              >
                {s}
              </button>
            ))}
            <input
              type="text"
              value={STORES.includes(store) ? '' : store}
              onChange={(e) => setStore(e.target.value)}
              placeholder="Other store"
              className="input-field focus:ring-section-grocery flex-1 min-w-[100px] !py-1.5 text-sm"
            />
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

      {/* Active List Tab */}
      {activeTab === 0 && (
        <>
          {/* Store Filter Pills */}
          {allStores.length > 1 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              <button
                onClick={() => setStoreFilter(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors ${
                  !storeFilter ? 'bg-section-grocery text-white' : 'bg-cream text-warmgray-600'
                }`}
              >
                All
              </button>
              {allStores.map(s => (
                <button
                  key={s}
                  onClick={() => setStoreFilter(storeFilter === s ? null : s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors ${
                    storeFilter === s
                      ? `${storeColors[s] || 'bg-warmgray-500'} text-white`
                      : 'bg-cream text-warmgray-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Grouped Items */}
          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16 text-warmgray-400">
              <svg className="w-16 h-16 mx-auto mb-3 opacity-50 animate-float" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <p className="font-medium">List is empty</p>
              <p className="text-sm mt-1">Tap + to add items</p>
            </div>
          ) : (
            Object.entries(grouped).map(([storeName, storeItems]) => (
              <div key={storeName} className="mb-4">
                <div
                  className={`${storeColors[storeName] || 'bg-warmgray-500'} text-white px-4 py-2.5 rounded-t-2xl font-medium text-sm flex items-center justify-between`}
                  onClick={() => setStoreFilter(storeFilter === storeName ? null : storeName)}
                >
                  <span className="font-heading">{storeName}</span>
                  <span className="text-xs opacity-80">{storeItems.filter(i => !i.checked).length} items</span>
                </div>
                <div className="bg-dark-surface rounded-b-2xl border border-t-0 border-warmgray-100 divide-y divide-warmgray-50 shadow-dark-sm">
                  {storeItems.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-opacity ${item.checked ? 'opacity-40' : ''}`}
                    >
                      <button
                        onClick={() => handleCheck(item)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          item.checked
                            ? 'bg-section-grocery border-section-grocery animate-check-off'
                            : 'border-warmgray-300'
                        }`}
                      >
                        {item.checked && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${item.checked ? 'line-through text-warmgray-400' : 'text-charcoal'}`}>
                          {item.name}
                          {item.unit && (
                            <span className="text-warmgray-400 font-normal text-xs ml-1">{item.unit}</span>
                          )}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-warmgray-400 truncate">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleAdjustQty(item, -1)}
                          className="w-7 h-7 rounded-full bg-cream flex items-center justify-center text-warmgray-600 active:bg-warmgray-200"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                          </svg>
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-charcoal">{item.qty || 1}</span>
                        <button
                          onClick={() => handleAdjustQty(item, 1)}
                          className="w-7 h-7 rounded-full bg-cream flex items-center justify-center text-warmgray-600 active:bg-warmgray-200"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-red-300 active:text-red-500 shrink-0 p-1"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Clear Checked */}
          {checkedCount > 0 && (
            <button
              onClick={() => clearChecked(user.id)}
              className="w-full py-3 text-sm font-medium text-red-400 bg-red-900/20 rounded-2xl mb-4"
            >
              Clear {checkedCount} checked item{checkedCount !== 1 ? 's' : ''}
            </button>
          )}
        </>
      )}

      {/* Recently Bought Tab */}
      {activeTab === 1 && (
        <div>
          {recentItems.length === 0 ? (
            <div className="text-center py-16 text-warmgray-400">
              <p className="font-medium">No recent purchases</p>
              <p className="text-sm mt-1">Items you check off will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentItems.map(item => (
                <div key={item.id} className="card flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-charcoal">
                      {item.name}
                      {item.qty && (
                        <span className="text-warmgray-400 font-normal ml-1">
                          x{item.qty}{item.unit ? ` ${item.unit}` : ''}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-warmgray-400">
                      {item.store && `${item.store} · `}
                      {new Date(item.bought_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAddBack(item)}
                    className="text-section-grocery font-medium text-sm shrink-0 px-3 py-1.5 bg-section-grocery/10 rounded-xl"
                  >
                    + Add Back
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scan Error */}
      {scanError && (
        <div className="card bg-red-900/20 border-red-800 text-red-400 text-sm mb-4">
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
