import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth } from './lib/auth.js'
import { checkRateLimit } from './lib/rate-limit.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ACTIONS = ['added', 'checked_off', 'removed']
const MAX_ITEM_NAME = 80

// Set up lazily: a missing VAPID var at import time used to throw on cold
// start and fail every call with an opaque 502.
let vapidReady = false
function ensureVapid() {
  if (vapidReady) return true
  if (!process.env.VITE_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:rob@elevatedroofingpartners.com',
    process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  vapidReady = true
  return true
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const authedUser = await verifyAuth(event)
  if (!authedUser) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

  try {
    const body = JSON.parse(event.body || '{}')
    const { household_id, action } = body
    const item_name = String(body.item_name || '').trim().slice(0, MAX_ITEM_NAME)

    if (!household_id || !ACTIONS.includes(action) || !item_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    // The sender is whoever holds the token, never a user id from the body.
    const changed_by_user_id = authedUser.id
    const { data: callerProfile } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', changed_by_user_id)
      .single()

    if (callerProfile?.household_id !== household_id) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
    }

    const { allowed } = await checkRateLimit(changed_by_user_id, 'send-push', 300)
    if (!allowed) return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }) }

    // Queue this change
    await supabase.from('grocery_notifications').insert({
      household_id,
      changed_by: changed_by_user_id,
      action,
      item_name,
    })

    if (!ensureVapid()) return { statusCode: 200, body: JSON.stringify({ queued: true }) }

    // Check if we should send now (1-hour debounce per recipient)
    const { data: recipients } = await supabase
      .from('users')
      .select('id, name, push_subscription, last_notified_at')
      .eq('household_id', household_id)
      .neq('id', changed_by_user_id)

    if (!recipients) return { statusCode: 200, body: JSON.stringify({ queued: true }) }

    const { data: changer } = await supabase
      .from('users')
      .select('name')
      .eq('id', changed_by_user_id)
      .single()
    const changerName = changer?.name || 'Someone'

    // Read the queue once. Only these rows are cleared afterwards, and only
    // after the loop, so every recipient in this pass sees the same summary.
    const { data: pending } = await supabase
      .from('grocery_notifications')
      .select('id, action, item_name, changed_by')
      .eq('household_id', household_id)
      .order('created_at', { ascending: true })
    let sentAny = false

    for (const recipient of recipients) {
      if (!recipient.push_subscription) continue

      // Check 1-hour debounce
      if (recipient.last_notified_at) {
        const elapsed = (Date.now() - new Date(recipient.last_notified_at).getTime()) / 1000 / 60
        if (elapsed < 60) continue
      }

      if (!pending || pending.length === 0) continue

      // Build summary message
      const added = pending.filter(p => p.action === 'added').map(p => p.item_name)
      const checked = pending.filter(p => p.action === 'checked_off').map(p => p.item_name)
      const removed = pending.filter(p => p.action === 'removed').map(p => p.item_name)

      const parts = []
      if (added.length > 0) parts.push(`added ${formatList(added)}`)
      if (checked.length > 0) parts.push(`checked off ${formatList(checked)}`)
      if (removed.length > 0) parts.push(`removed ${formatList(removed)}`)

      const body = `${changerName} ${parts.join(' and ')}`

      try {
        await webpush.sendNotification(
          recipient.push_subscription,
          JSON.stringify({
            title: 'Grocery List',
            body,
            icon: '/icon-192.png',
          })
        )

        await supabase
          .from('users')
          .update({ last_notified_at: new Date().toISOString() })
          .eq('id', recipient.id)
        sentAny = true
      } catch (pushErr) {
        console.error(`Push failed for user ${recipient.id}:`, pushErr)
        if (pushErr.statusCode === 410) {
          await supabase
            .from('users')
            .update({ push_subscription: null })
            .eq('id', recipient.id)
        }
      }
    }

    if (sentAny && pending?.length) {
      await supabase.from('grocery_notifications').delete().in('id', pending.map(p => p.id))
    }
    // Nothing keeps a stale change worth summarising after a day.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('grocery_notifications').delete().eq('household_id', household_id).lt('created_at', dayAgo)

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('Push notification error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to process notification' }) }
  }
}

function formatList(items) {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}
