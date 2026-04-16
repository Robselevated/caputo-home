import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth } from './lib/auth.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:rob@elevatedroofingpartners.com',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const authedUser = await verifyAuth(event)
  if (!authedUser) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

  try {
    const { household_id, changed_by_user_id, action, item_name } = JSON.parse(event.body)

    if (!household_id || !changed_by_user_id || !action || !item_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    // Verify the caller belongs to this household
    const { data: callerProfile } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', authedUser.id)
      .single()

    if (callerProfile?.household_id !== household_id) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
    }

    // Queue this change
    await supabase.from('grocery_notifications').insert({
      household_id,
      changed_by: changed_by_user_id,
      action,
      item_name,
    })

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

    for (const recipient of recipients) {
      if (!recipient.push_subscription) continue

      // Check 1-hour debounce
      if (recipient.last_notified_at) {
        const elapsed = (Date.now() - new Date(recipient.last_notified_at).getTime()) / 1000 / 60
        if (elapsed < 60) continue
      }

      // Collect all pending changes for this household
      const { data: pending } = await supabase
        .from('grocery_notifications')
        .select('action, item_name, changed_by')
        .eq('household_id', household_id)
        .order('created_at', { ascending: true })

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

        // Clear sent notifications
        await supabase
          .from('grocery_notifications')
          .delete()
          .eq('household_id', household_id)
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
