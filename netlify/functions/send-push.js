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
    const { household_id, changed_by_user_id, message } = JSON.parse(event.body)

    if (!household_id || !changed_by_user_id) {
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

    // Get all users in household except the one who made the change
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, push_subscription, last_notified_at')
      .eq('household_id', household_id)
      .neq('id', changed_by_user_id)

    if (error || !users) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch users' }) }
    }

    // Get the name of the user who made the change
    const { data: changer } = await supabase
      .from('users')
      .select('name')
      .eq('id', changed_by_user_id)
      .single()

    const changerName = changer?.name || 'Someone'

    for (const user of users) {
      if (!user.push_subscription) continue

      // Debounce: max 1 push per hour
      if (user.last_notified_at) {
        const lastNotified = new Date(user.last_notified_at)
        const now = new Date()
        const diffMinutes = (now - lastNotified) / 1000 / 60
        if (diffMinutes < 60) continue
      }

      try {
        await webpush.sendNotification(
          user.push_subscription,
          JSON.stringify({
            title: 'Caputo Home',
            body: message || `${changerName} updated the household app`,
            icon: '/icon-192.png',
          })
        )

        // Update last_notified_at
        await supabase
          .from('users')
          .update({ last_notified_at: new Date().toISOString() })
          .eq('id', user.id)
      } catch (pushErr) {
        console.error(`Push failed for user ${user.id}:`, pushErr)
        // If subscription expired, clear it
        if (pushErr.statusCode === 410) {
          await supabase
            .from('users')
            .update({ push_subscription: null })
            .eq('id', user.id)
        }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('Push notification error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send notification' }) }
  }
}
