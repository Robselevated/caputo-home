import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushNotifications(userId) {
  const [permission, setPermission] = useState(Notification?.permission || 'default')
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    checkSubscription()
  }, [])

  const checkSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    } catch {
      // Service worker not ready yet
    }
  }

  const requestPermission = async () => {
    if (!('Notification' in window)) return false

    const result = await Notification.requestPermission()
    setPermission(result)

    if (result === 'granted') {
      await subscribe()
      return true
    }
    return false
  }

  const subscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Save subscription to user record
      await supabase
        .from('users')
        .update({ push_subscription: sub.toJSON() })
        .eq('id', userId)

      setSubscribed(true)
    } catch (err) {
      console.error('Push subscription failed:', err)
    }
  }

  const sendPushNotification = async (householdId, changedByUserId, message) => {
    try {
      await fetch('/.netlify/functions/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household_id: householdId,
          changed_by_user_id: changedByUserId,
          message,
        }),
      })
    } catch {
      // Non-critical, fail silently
    }
  }

  return { permission, subscribed, requestPermission, sendPushNotification }
}
