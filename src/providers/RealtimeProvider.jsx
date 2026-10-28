import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { onRevalidate } from '../lib/sessionManager'
import { keys } from '../queries/keys'
import { applyChange, CLIENT_FIELDS } from '../lib/realtimeCache'
import { sortInventory } from '../lib/inventoryRealtime'
import { invalidateDebounced } from '../queries/invalidate'

// ONE realtime channel per household, mounted once in the app shell. Every
// event patches the query cache by id; nothing here refetches a whole list.
// (Each page used to open its own channels and refetch on every event.)

const TABLES = ['grocery_items', 'inventory_items', 'recently_bought', 'recipes', 'meal_picks', 'recipe_ingredients', 'restaurants', 'restaurant_ratings', 'restaurant_notes']

const newestFirst = (field) => (rows) => [...rows].sort((a, b) => new Date(b[field]) - new Date(a[field]))
const byOrder = (rows) => [...rows].sort((a, b) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
const oldestFirst = (field) => (rows) => [...rows].sort((a, b) => new Date(a[field]) - new Date(b[field]))

export function applyRealtimeEvent(qc, householdId, payload) {
  switch (payload?.table) {
    case 'grocery_items':
      qc.setQueryData(keys.grocery(householdId), prev => applyChange(prev, payload, { preserve: CLIENT_FIELDS }))
      break
    case 'inventory_items':
      qc.setQueryData(keys.inventory(householdId), prev => applyChange(prev, payload, { sort: sortInventory }))
      break
    case 'recently_bought':
      qc.setQueryData(keys.recentlyBought(householdId), prev => applyChange(prev, payload, { sort: newestFirst('bought_at') }))
      invalidateDebounced(qc, keys.itemHistory(householdId))
      break
    case 'recipes': {
      qc.setQueryData(keys.recipes(householdId), prev => applyChange(prev, payload, { sort: newestFirst('created_at') }))
      const id = payload.new?.id ?? payload.old?.id
      if (id) qc.invalidateQueries({ queryKey: keys.recipe(id) })
      break
    }
    case 'meal_picks':
      qc.setQueryData(keys.mealPicks(householdId), prev => applyChange(prev, payload, { sort: oldestFirst('created_at') }))
      break
    case 'restaurants':
      qc.setQueryData(keys.restaurants(householdId), prev => applyChange(prev, payload, { sort: byOrder }))
      break
    // Ratings key on (restaurant, user), not id, so they refetch instead.
    case 'restaurant_ratings':
      invalidateDebounced(qc, keys.restaurantRatings(householdId))
      break
    case 'restaurant_notes':
      qc.setQueryData(keys.restaurantNotes(householdId), prev => applyChange(prev, payload, { sort: oldestFirst('created_at') }))
      break
    case 'recipe_ingredients': {
      invalidateDebounced(qc, keys.recipeIngredients(householdId))
      const rid = payload.new?.recipe_id ?? payload.old?.recipe_id
      if (rid) invalidateDebounced(qc, keys.recipe(rid))
      break
    }
    default:
      break
  }
}

export function RealtimeProvider({ householdId, children }) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!householdId) return undefined
    let channel = null
    let retryTimer = null
    let attempt = 0
    let backoff = 0
    let disposed = false

    const subscribe = () => {
      attempt += 1
      // A fresh topic per attempt: re-creating the same topic while the old
      // channel is still leaving hands back the dying channel.
      const topic = attempt === 1 ? `household:${householdId}` : `household:${householdId}:${attempt}`
      const ch = supabase.channel(topic)
      channel = ch
      for (const table of TABLES) {
        const opts = { event: '*', schema: 'public', table }
        // recipe_ingredients has no household_id column; it is scoped via the
        // recipes join at fetch time and only ever invalidates here.
        if (table !== 'recipe_ingredients') opts.filter = `household_id=eq.${householdId}`
        ch.on('postgres_changes', opts, (payload) => {
          applyRealtimeEvent(qc, householdId, { ...payload, table: payload?.table ?? table })
        })
      }
      ch.subscribe((status) => {
        if (disposed || ch !== channel) return // stale callback from a dead channel
        if (status === 'SUBSCRIBED') {
          backoff = 0
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Socket down (background, resume's deliberate reconnect): phoenix
          // rejoins every channel itself when the socket returns. Only a
          // rejection while the socket is up means THIS channel is dead.
          if (typeof supabase.realtime?.isConnected === 'function' && !supabase.realtime.isConnected()) return
          channel = null
          supabase.removeChannel(ch)
          if (retryTimer) clearTimeout(retryTimer)
          const delay = Math.min(1000 * 2 ** backoff, 30000)
          backoff += 1
          retryTimer = setTimeout(() => {
            retryTimer = null
            if (!disposed) subscribe()
          }, delay)
        }
      })
    }

    subscribe()
    const offRevalidate = onRevalidate(() => qc.invalidateQueries())

    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      if (channel) supabase.removeChannel(channel)
      channel = null
      offRevalidate()
    }
  }, [householdId, qc])

  return children
}
