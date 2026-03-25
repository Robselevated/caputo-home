import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useScanSession(householdId) {
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const uploadAndScan = async (file, scanType, userId) => {
    setScanning(true)
    setError(null)
    setResults(null)

    try {
      // Upload image to Supabase Storage
      const fileName = `${householdId}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('scan-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('scan-images')
        .getPublicUrl(fileName)

      const imageUrl = urlData.publicUrl

      // Create scan session
      const { data: session } = await supabase.from('scan_sessions').insert({
        household_id: householdId,
        scan_type: scanType,
        image_url: imageUrl,
        status: 'pending_review',
        created_by: userId,
      }).select().single()

      // Call Netlify function for Claude Vision analysis
      const response = await fetch('/.netlify/functions/claude-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          scan_type: scanType,
          household_id: householdId,
        }),
      })

      if (!response.ok) throw new Error('Scan failed')

      const items = await response.json()

      // Update scan session with raw results
      await supabase.from('scan_sessions').update({
        raw_result: items,
      }).eq('id', session.id)

      setResults({ sessionId: session.id, items })
    } catch (err) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  const confirmItems = async (sessionId, confirmedItems, location, userId) => {
    try {
      for (const item of confirmedItems) {
        if (location === 'receipt') {
          // Receipt scan: add to recently_bought + item_history
          await supabase.from('recently_bought').insert({
            household_id: householdId,
            name: item.name,
            qty: item.qty,
            unit: item.unit,
            store: item.store || null,
            bought_by: userId,
          })
          await supabase.from('item_history').upsert(
            { household_id: householdId, name: item.name },
            { onConflict: 'household_id,name' }
          )
        } else {
          // Inventory scan: upsert to inventory_items
          // Check if item already exists (same name, same location, same category)
          const { data: existing } = await supabase
            .from('inventory_items')
            .select('id, qty')
            .eq('household_id', householdId)
            .eq('location', location)
            .ilike('name', item.name)
            .single()

          if (existing) {
            // Add to existing qty
            await supabase.from('inventory_items').update({
              qty: existing.qty + (item.qty || 1),
              updated_by: userId,
              updated_at: new Date().toISOString(),
            }).eq('id', existing.id)
          } else {
            // Insert new item
            await supabase.from('inventory_items').insert({
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
          }
        }
      }

      // Update scan session
      await supabase.from('scan_sessions').update({
        confirmed_items: confirmedItems,
        status: 'confirmed',
      }).eq('id', sessionId)

      setResults(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const cancelScan = async (sessionId) => {
    if (sessionId) {
      await supabase.from('scan_sessions').update({
        status: 'cancelled',
      }).eq('id', sessionId)
    }
    setResults(null)
    setError(null)
  }

  return { scanning, results, error, uploadAndScan, confirmItems, cancelScan }
}
