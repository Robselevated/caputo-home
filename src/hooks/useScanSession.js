import { useState } from 'react'
import { supabase } from '../lib/supabase'

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
    try {
      for (const item of confirmedItems) {
        if (location === 'receipt') {
          const { error: insertErr } = await supabase.from('recently_bought').insert({
            household_id: householdId,
            name: item.name,
            qty: item.qty,
            unit: item.unit,
            store: item.store || null,
            bought_by: userId,
          })
          if (insertErr) { errors.push(`${item.name}: ${insertErr.message}`); continue }
          await supabase.from('item_history').upsert(
            { household_id: householdId, name: item.name },
            { onConflict: 'household_id,name' }
          )
        } else {
          const { data: existing } = await supabase
            .from('inventory_items')
            .select('id, qty')
            .eq('household_id', householdId)
            .eq('location', location)
            .ilike('name', item.name)
            .single()

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
