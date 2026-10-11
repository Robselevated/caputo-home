import { useEffect, useMemo, useState } from 'react'
import { ShoppingCart, ReceiptText, Bell } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useGroceryList } from '../../hooks/useGroceryList'
import { useRecentlyBought } from '../../hooks/useRecentlyBought'
import { useItemHistory } from '../../hooks/useItemHistory'
import { useScanSession } from '../../hooks/useScanSession'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pill } from '../../components/ui/Pill'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSkeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/Toast'
import PhotoScanner from '../../components/PhotoScanner'
import ReceiptReview from '../../pages/ReceiptReview'
import { STORES, getDefaultStore } from '../../lib/constants'
import { GroceryAddBar } from './GroceryAddBar'
import { GroceryStoreGroup } from './GroceryStoreGroup'
import { GroceryItemEditSheet } from './GroceryItemEditSheet'
import { RecentlyBought } from './RecentlyBought'
import { usePendingCheckOff } from './usePendingCheckOff'
import { storeTheme, storeLabel } from './storeTheme'

const NOTIF_DISMISSED_KEY = 'notif-dismissed'

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    if (!!a.checked !== !!b.checked) return a.checked ? 1 : -1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
  })
}

export default function GroceryPage() {
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const userId = user?.id
  const { items, loading, addItem, checkItem, uncheckItem, deleteItem, updateItem, markChecked, markUnchecked, reorderItems } = useGroceryList(householdId)
  const { items: recentItems, addBackToList } = useRecentlyBought(householdId)
  const { getSuggestions } = useItemHistory(householdId)
  const { scanning, results, error: scanError, uploadAndScan, confirmItems, cancelScan } = useScanSession(householdId)
  const { permission, requestPermission, sendPushNotification } = usePushNotifications(userId)

  const [storeFilter, setStoreFilter] = useState(null)
  const [editing, setEditing] = useState(null)
  const [showNotifBanner, setShowNotifBanner] = useState(false)

  const { check } = usePendingCheckOff({
    checkItem, uncheckItem, markChecked, markUnchecked, userId,
    onCheck: (item) => sendPushNotification(householdId, userId, 'checked_off', item.name).catch(() => {}),
  })
  const { requestDelete, hiddenIds } = useDeleteWithUndo(deleteItem, { message: (item) => `${item.name} removed` })

  useEffect(() => {
    if (scanError) toast({ message: `Scan failed: ${scanError}`, tone: 'error' })
  }, [scanError])

  useEffect(() => {
    try {
      if (permission === 'default' && !localStorage.getItem(NOTIF_DISMISSED_KEY)) setShowNotifBanner(true)
    } catch { /* storage unavailable */ }
  }, [permission])

  const visible = useMemo(() => (hiddenIds.size ? items.filter(i => !hiddenIds.has(i.id)) : items), [items, hiddenIds])

  // Stores in a fixed order: the presets first, then anything custom.
  const stores = useMemo(() => {
    const present = new Set(visible.map(i => storeLabel(i.store)))
    return [...STORES.filter(s => present.has(s)), ...[...present].filter(s => !STORES.includes(s)).sort()]
  }, [visible])

  const grouped = useMemo(() => {
    const groups = new Map()
    for (const item of visible) {
      const label = storeLabel(item.store)
      if (storeFilter && label !== storeFilter) continue
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label).push(item)
    }
    return stores.filter(s => groups.has(s)).map(s => [s, sortRows(groups.get(s))])
  }, [visible, stores, storeFilter])

  const openCount = visible.filter(i => !i.checked).length
  const subtitle = loading && items.length === 0
    ? 'Loading your list'
    : openCount === 0
      ? 'Nothing on the list'
      : `${openCount} item${openCount === 1 ? '' : 's'} in ${stores.length} store${stores.length === 1 ? '' : 's'}`

  const handleAdd = async (name) => {
    const res = await addItem({ name, qty: 1, unit: '', store: getDefaultStore(name), notes: '', userId })
    if (!res?.error) sendPushNotification(householdId, userId, 'added', name).catch(() => {})
  }
  const handleQty = (item, delta) => updateItem(item.id, { qty: Math.max(1, (item.qty ?? 1) + delta) }, userId)
  const handleSave = (id, changes) => {
    const current = items.find(i => i.id === id)
    if (current && storeLabel(changes.store) !== storeLabel(current.store)) {
      // Moving store: land at the end of the new group, as a fresh add would.
      const target = storeLabel(changes.store)
      const maxSort = items
        .filter(i => i.id !== id && storeLabel(i.store) === target)
        .reduce((max, i) => Math.max(max, i.sort_order ?? 0), 0)
      changes = { ...changes, sort_order: maxSort + 1 }
    }
    return updateItem(id, changes, userId)
  }
  const handleReorder = (ids) => reorderItems(ids, userId)

  const enableNotifications = async () => { await requestPermission(); setShowNotifBanner(false) }
  const dismissNotifications = () => {
    setShowNotifBanner(false)
    try { localStorage.setItem(NOTIF_DISMISSED_KEY, '1') } catch { /* storage unavailable */ }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5">
      {showNotifBanner && (
        <div className="flex items-center gap-3 rounded-row bg-surface py-2.5 pl-3.5 pr-2 shadow-soft">
          <Bell size={20} aria-hidden="true" className="shrink-0 text-accent-grocery" />
          <p className="flex-1 text-[13px] text-ink">Get a nudge when the list changes?</p>
          <button type="button" onClick={enableNotifications} className="h-10 rounded-full bg-accent-grocery px-3.5 text-[13px] font-semibold text-white">Turn on</button>
          <button type="button" onClick={dismissNotifications} className="h-10 rounded-full px-2.5 text-[13px] font-semibold text-ink-2">Not now</button>
        </div>
      )}

      <PageHeader
        title="Grocery"
        subtitle={subtitle}
        action={
          <PhotoScanner
            label="Scan a receipt"
            icon={ReceiptText}
            scanning={scanning}
            onCapture={(file) => uploadAndScan(file, 'receipt_inventory', userId)}
          />
        }
      />

      <GroceryAddBar onAdd={handleAdd} getSuggestions={getSuggestions} accentClass="bg-accent-grocery" />

      {stores.length > 1 && (
        <div role="group" aria-label="Filter by store" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 no-scrollbar">
          <Pill active={!storeFilter} onClick={() => setStoreFilter(null)}>All</Pill>
          {stores.map((s) => {
            const t = storeTheme(s)
            return (
              <Pill
                key={s}
                active={storeFilter === s}
                activeClass={`${t.accentBg} text-white`}
                inactiveClass={`${t.tile} ${t.ink}`}
                onClick={() => setStoreFilter(storeFilter === s ? null : s)}
              >
                {s}
              </Pill>
            )
          })}
        </div>
      )}

      {loading && items.length === 0 ? (
        <ListSkeleton />
      ) : grouped.length === 0 ? (
        <EmptyState icon={ShoppingCart} title={storeFilter ? `Nothing for ${storeFilter}` : 'Nothing on the list'} hint={storeFilter ? 'Tap All to see every store' : 'Type something above and tap Add'} />
      ) : (
        grouped.map(([store, rows]) => (
          <GroceryStoreGroup
            key={store}
            store={store}
            items={rows}
            onCheck={check}
            onQty={handleQty}
            onOpen={setEditing}
            onReorder={handleReorder}
          />
        ))
      )}

      <RecentlyBought items={recentItems} onAddBack={(item) => addBackToList(item, userId)} />

      <GroceryItemEditSheet item={editing} onClose={() => setEditing(null)} onSave={handleSave} onDelete={requestDelete} />

      {results && (
        <ReceiptReview
          items={results.items}
          onConfirm={(confirmed, loc) => confirmItems(confirmed, loc, userId)}
          onCancel={cancelScan}
          householdId={householdId}
        />
      )}
    </div>
  )
}
