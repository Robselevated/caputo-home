import { useState, useCallback, useMemo } from 'react'
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
  const taxonomyKeys = Object.keys(TAXONOMY[location] || {})

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
      const next = arrayMove(prev, oldIndex, newIndex)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [STORAGE_KEY])

  const orderedCategories = useMemo(
    () => mergeSavedWithTaxonomy(order, taxonomyKeys),
    [order, taxonomyKeys]
  )

  return { orderedCategories, reorder }
}
