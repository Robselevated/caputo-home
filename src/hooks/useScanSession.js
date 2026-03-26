import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { TAXONOMY } from '../lib/constants'

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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // result is "data:<media_type>;base64,<data>" — split off the prefix
      const dataUrl = reader.result
      const commaIndex = dataUrl.indexOf(',')
      resolve({
        base64: dataUrl.slice(commaIndex + 1),
        media_type: file.type || 'image/jpeg',
      })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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
      // Convert file to base64 (bypasses Supabase Storage entirely)
      const { base64, media_type } = await fileToBase64(file)

      // Call Netlify function with base64 image
      const response = await fetch('/.netlify/functions/claude-scan', {
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

  const confirmItems = async (confirmedItems, location, userId) => {
    const errors = []

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
        if (insertErr) { errors.push(`${item.name}: ${insertErr.message}`); return }
        await supabase.from('item_history').upsert(
          { household_id: householdId, name: item.name },
          { onConflict: 'household_id,name' }
        )
      } else {
        const { data: matches, error: lookupErr } = await supabase
          .from('inventory_items')
          .select('id, qty')
          .eq('household_id', householdId)
          .eq('location', location)
          .ilike('name', item.name)

        if (lookupErr) {
          errors.push(`${item.name}: ${lookupErr.message}`)
          return
        }

        const existing = matches && matches.length > 0 ? matches[0] : null

        if (existing) {
          const { error: updateErr } = await supabase.from('inventory_items').update({
            qty: existing.qty + (item.qty || 1),
            updated_by: userId,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id)
          if (updateErr) errors.push(`${item.name}: ${updateErr.message}`)
        } else {
          const { error: insertErr } = await supabase.from('inventory_items').insert({
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
          if (insertErr) errors.push(`${item.name}: ${insertErr.message}`)
        }
      }
    }

    try {
      // Process in batches of 5 for speed without overwhelming DB
      for (let i = 0; i < confirmedItems.length; i += 5) {
        const batch = confirmedItems.slice(i, i + 5)
        await Promise.allSettled(batch.map(processItem))
      }

      if (errors.length > 0) {
        setError(`Failed to add: ${errors.join(', ')}`)
      }
      setResults(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const cancelScan = () => {
    setResults(null)
    setError(null)
  }

  return { scanning, results, error, uploadAndScan, confirmItems, cancelScan }
}
