import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import { upsertById, removeById } from '../lib/realtimeCache'
import { keys, STALE } from '../queries/keys'
import { fetchRecentlyBought } from '../queries/fetchers'
import { insertGroceryItem } from '../queries/writes'

const EMPTY = []

export function useRecentlyBought(householdId) {
  const qc = useQueryClient()

  const { data: items = EMPTY, isPending } = useQuery({
    queryKey: keys.recentlyBought(householdId),
    queryFn: () => fetchRecentlyBought(supabase, householdId),
    enabled: !!householdId,
    staleTime: STALE.recentlyBought,
  })

  // Put a bought item back on the grocery list (optimistic on the grocery cache).
  const addBackToList = async (item, userId) => {
    if (!householdId) return { error: 'No household' }
    const groceryKey = keys.grocery(householdId)
    const row = {
      id: crypto.randomUUID(),
      household_id: householdId,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      store: item.store,
      notes: item.notes,
      checked: false,
      added_by: userId,
      updated_by: userId,
    }
    qc.setQueryData(groceryKey, prev => (prev ? [...prev, { ...row, created_at: new Date().toISOString() }] : prev))
    try {
      const saved = await insertGroceryItem(supabase, row)
      if (saved) qc.setQueryData(groceryKey, prev => (prev ? upsertById(prev, saved) : prev))
      toast({ message: `${item.name} is back on the list` })
      return { error: null }
    } catch (error) {
      qc.setQueryData(groceryKey, prev => (prev ? removeById(prev, row.id) : prev))
      toast({ message: `Couldn't add ${item.name} back`, tone: 'error' })
      return { error }
    }
  }

  return { items, loading: isPending, addBackToList }
}
