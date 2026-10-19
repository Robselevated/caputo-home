import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { TAXONOMY } from '../lib/constants'

function mergeSavedWithTaxonomy(savedOrder, taxonomyKeys) {
  const taxonomySet = new Set(taxonomyKeys)
  const savedSet = new Set(savedOrder)
  const kept = savedOrder.filter(cat => taxonomySet.has(cat))
  const added = taxonomyKeys.filter(cat => !savedSet.has(cat))
  return [...kept, ...added]
}

export function useCategoryOrder(location) {
  const STORAGE_KEY = `category-order-${location}`
  // Stable per location, so the memo below does not recompute every render.
  const taxonomyKeys = useMemo(() => Object.keys(TAXONOMY[location] || {}), [location])

  const [order, setOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return taxonomyKeys
      return mergeSavedWithTaxonomy(JSON.parse(saved), taxonomyKeys)
    } catch {
      return taxonomyKeys
    }
  })

  const reorder = useCallback((activeId, overId) => {
    if (activeId === overId) return
    setOrder(prev => {
      const oldIndex = prev.indexOf(activeId)
      const newIndex = prev.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  // Persist after the change, not inside the state updater: StrictMode runs
  // updaters twice, and a blocked storage would throw during render. Only a
  // real change is written, so the loaded order never overwrites itself.
  const saved = useRef(order)
  useEffect(() => {
    if (saved.current === order) return
    saved.current = order
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)) } catch { /* storage blocked: order lasts this session */ }
  }, [order, STORAGE_KEY])

  const orderedCategories = useMemo(
    () => mergeSavedWithTaxonomy(order, taxonomyKeys),
    [order, taxonomyKeys]
  )

  return { orderedCategories, reorder }
}
