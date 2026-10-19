import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { authFetch } from '../lib/authFetch'
import { TAXONOMY } from '../lib/constants'
import { queryClient } from '../lib/queryClient'
import { keys } from '../queries/keys'
import { mergeInventoryItem } from '../queries/writes'
import { prepareImage } from '../features/cookbook/recipeScan'

// Keywords to catch items Claude miscategorizes as "Other"
const CATEGORY_KEYWORDS = {
  pantry: {
    'Bread': ['bread', 'bagel', 'bun', 'roll', 'tortilla', 'naan', 'pita', 'english muffin', 'baguette', 'sourdough', 'ciabatta', 'focaccia', 'croissant', 'loaf', 'wrap'],
    'Pasta': ['pasta', 'spaghetti', 'penne', 'farfalle', 'elbow', 'fettuccine', 'linguine', 'angel hair', 'rigatoni', 'rotini', 'lasagna', 'orzo', 'macaroni', 'noodle'],
    'Canned Goods': ['canned', 'can of'],
    'Snacks': ['chips', 'crackers', 'pretzels', 'popcorn', 'granola bar'],
  },
  fridge: {
    'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'egg', 'cream', 'sour cream', 'cream cheese'],
    'Condiments': ['ketchup', 'mustard', 'hot sauce', 'mayo', 'mayonnaise', 'ranch', 'salad dressing', 'bbq sauce', 'soy sauce', 'worcestershire', 'relish', 'salsa'],
    'Broth/Stock': ['broth', 'stock', 'bouillon', 'bone broth'],
    'Bread': ['bread', 'bagel', 'bun', 'roll', 'tortilla', 'pita', 'english muffin', 'wrap'],
    'Beverages': ['juice', 'soda', 'water', 'beer', 'wine', 'kombucha', 'iced tea', 'lemonade'],
    'Fresh Produce': ['lettuce', 'romaine', 'spinach', 'kale', 'arugula', 'greens', 'tomato', 'cucumber', 'pepper', 'onion', 'celery', 'carrot', 'broccoli', 'cauliflower', 'mushroom', 'zucchini', 'squash', 'avocado', 'apple', 'orange', 'pear', 'lemon', 'lime', 'grape', 'berry', 'strawberry', 'blueberry', 'raspberry', 'banana', 'melon', 'watermelon', 'mango', 'pineapple', 'peach', 'plum', 'clementine', 'mandarin', 'grapefruit', 'fruit', 'vegetable', 'veggie', 'produce', 'salad', 'herb', 'cilantro', 'basil', 'parsley', 'dill', 'mint', 'radish', 'cabbage', 'corn', 'asparagus', 'green bean', 'scallion', 'shallot', 'garlic', 'ginger'],
  },
}

// Remap old fridge produce categories to "Fresh Produce"
const LEGACY_PRODUCE = ['Lettuce', 'Apples', 'Oranges', 'Pears', 'Produce (Other)']

// If Claude puts an item in "Other" or uses a legacy category, remap it
function fixCategory(item, location) {
  const taxonomy = TAXONOMY[location]
  if (!taxonomy) return item

  // Remap legacy produce categories
  if (location === 'fridge' && LEGACY_PRODUCE.includes(item.category)) {
    return { ...item, category: 'Fresh Produce', subcategory: null }
  }

  if (item.category !== 'Other') return item

  // Pass 1: subcategory matches a real category name
  if (item.subcategory) {
    const sub = item.subcategory.toLowerCase()
    for (const cat of Object.keys(taxonomy)) {
      if (cat === 'Other') continue
      if (cat.toLowerCase() === sub || cat.toLowerCase().includes(sub) || sub.includes(cat.toLowerCase())) {
        return { ...item, category: cat, subcategory: null }
      }
    }
  }

  // Pass 2: item name contains keywords for a known category
  const keywords = CATEGORY_KEYWORDS[location]
  if (keywords) {
    const nameLower = item.name.toLowerCase()
    for (const [cat, kws] of Object.entries(keywords)) {
      if (kws.some(kw => nameLower.includes(kw))) {
        return { ...item, category: cat, subcategory: null }
      }
    }
  }

  return item
}

// Shrink the photo to a JPEG the model reads at full detail anyway (long
// edge about 1568). A raw phone photo sent as base64 could pass Netlify's 6MB
// request limit and fail with a bare "Scan failed". Never tiled: a pantry
// shelf or a receipt is one picture.
async function photoForScan(file) {
  const { tiles } = await prepareImage(file, { maxRatio: Infinity })
  return { base64: tiles[0].base64, media_type: tiles[0].media_type }
}

export function useScanSession(householdId) {
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const uploadAndScan = async (file, scanType, userId) => {
    setScanning(true)
    setError(null)
    setResults(null)

    try {
      const { base64, media_type } = await photoForScan(file)

      // Call Netlify function with base64 image
      const response = await authFetch('/.netlify/functions/claude-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64,
          media_type,
          scan_type: scanType,
        }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error(errBody.error || 'Scan failed')
      }

      const items = await response.json()
      setResults({ items })
    } catch (err) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  // Resolves { saved, failed } (the passed-in item objects) so a review sheet
  // can act only on what saved and keep the failures on screen for a retry.
  // The scan closes only when everything saved, unless `close: false` (the
  // receipt sheet confirms one location at a time and closes itself).
  const confirmItems = async (confirmedItems, location, userId, { close = true } = {}) => {
    const errors = []
    const failed = new Set()

    const processItem = async (rawItem) => {
      const item = location !== 'receipt' ? fixCategory(rawItem, location) : rawItem
      if (location === 'receipt') {
        const { error: insertErr } = await supabase.from('recently_bought').insert({
          household_id: householdId,
          name: item.name,
          qty: item.qty,
          unit: item.unit,
          store: item.store || null,
          bought_by: userId,
        })
        if (insertErr) { errors.push(`${item.name}: ${insertErr.message}`); failed.add(rawItem); return }
        await supabase.from('item_history').upsert(
          { household_id: householdId, name: item.name },
          { onConflict: 'household_id,name' }
        )
      } else {
        // One merge per item: increments the existing row for this
        // household + location + normalized name, or inserts it.
        try {
          await mergeInventoryItem(supabase, {
            household_id: householdId,
            name: item.name,
            qty: item.qty || 1,
            unit: item.unit || 'count',
            location,
            category: item.category || 'Other',
            subcategory: item.subcategory || null,
            notes: item.notes || null,
            updated_by: userId,
          })
        } catch (mergeErr) {
          errors.push(`${item.name}: ${mergeErr.message}`)
          failed.add(rawItem)
        }
      }
    }

    try {
      // Process in batches of 5 for speed without overwhelming DB
      for (let i = 0; i < confirmedItems.length; i += 5) {
        const batch = confirmedItems.slice(i, i + 5)
        const settled = await Promise.allSettled(batch.map(processItem))
        settled.forEach((r, j) => {
          if (r.status === 'rejected') {
            failed.add(batch[j])
            errors.push(`${batch[j]?.name}: ${r.reason?.message ?? 'failed'}`)
          }
        })
      }

      if (errors.length > 0) {
        setError(`Failed to add: ${errors.join(', ')}`)
      } else if (close) {
        setResults(null)
      }
      // Realtime usually patches these; invalidating guarantees the list is
      // right even if the socket is down.
      if (householdId) {
        queryClient.invalidateQueries({ queryKey: keys.inventory(householdId) })
        if (location === 'receipt') queryClient.invalidateQueries({ queryKey: keys.recentlyBought(householdId) })
      }
    } catch (err) {
      setError(err.message)
      return { saved: [], failed: [...confirmedItems] }
    }
    return {
      saved: confirmedItems.filter(i => !failed.has(i)),
      failed: confirmedItems.filter(i => failed.has(i)),
    }
  }

  const cancelScan = () => {
    setResults(null)
    setError(null)
  }

  return { scanning, results, error, uploadAndScan, confirmItems, cancelScan }
}
