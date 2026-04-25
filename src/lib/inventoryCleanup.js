import { supabase } from './supabase'
import { getDefaultLocation } from './constants'

const FLAG_KEY_PREFIX = 'inv-cleanup-v2-'

// One-time pass per household: merges case-insensitive name duplicates and
// recategorizes items currently sitting in 'Other' to their correct
// location/category based on the latest keyword rules.
//
// Idempotent and bails fast if no work to do. Skips itself entirely once the
// household-specific localStorage flag is set, so it's safe to call from any
// landing-page useEffect on every mount.
export async function runOneTimeInventoryCleanup(householdId, userId) {
  if (!householdId || typeof window === 'undefined') return
  const flagKey = FLAG_KEY_PREFIX + householdId
  if (window.localStorage.getItem(flagKey)) return

  try {
    const { data: items, error } = await supabase
      .from('inventory_items')
      .select('id, name, qty, location, category, created_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('Inventory cleanup: fetch failed', error.message)
      return
    }
    if (!items || items.length === 0) {
      window.localStorage.setItem(flagKey, '1')
      return
    }

    const groups = new Map()
    for (const item of items) {
      const key = (item.name || '').trim().toLowerCase()
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    }

    let mergedDups = 0
    let recategorized = 0

    for (const group of groups.values()) {
      const [keep, ...dups] = group
      const updates = {}

      if (dups.length > 0) {
        const totalQty = group.reduce((sum, it) => sum + (Number(it.qty) || 0), 0)
        updates.qty = totalQty
        for (const dup of dups) {
          const { error: delErr } = await supabase.from('inventory_items').delete().eq('id', dup.id)
          if (delErr) {
            console.warn('Inventory cleanup: delete failed', dup.id, delErr.message)
          } else {
            mergedDups++
          }
        }
      }

      if (keep.category === 'Other') {
        const { location, category } = getDefaultLocation(keep.name)
        if (location !== keep.location || category !== keep.category) {
          updates.location = location
          updates.category = category
          recategorized++
        }
      }

      if (Object.keys(updates).length > 0) {
        if (userId) updates.updated_by = userId
        const { error: updErr } = await supabase
          .from('inventory_items')
          .update(updates)
          .eq('id', keep.id)
        if (updErr) {
          console.warn('Inventory cleanup: update failed', keep.id, updErr.message)
        }
      }
    }

    if (mergedDups > 0 || recategorized > 0) {
      console.log(`Inventory cleanup: merged ${mergedDups} duplicate row(s), recategorized ${recategorized} item(s)`)
    }
    window.localStorage.setItem(flagKey, '1')
  } catch (err) {
    console.warn('Inventory cleanup failed:', err?.message ?? err)
  }
}
