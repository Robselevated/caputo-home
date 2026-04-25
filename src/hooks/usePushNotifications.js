import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { authFetch } from '../lib/authFetch'

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

const pushSupported = typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window

function getPermission() {
  try {
    return pushSupported ? Notification.permission : 'denied'
  } catch {
    return 'denied'
  }
}

export function usePushNotifications(userId) {
  const [permission, setPermission] = useState(getPermission)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (!pushSupported) return
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
    if (!pushSupported) return false

    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result === 'granted') {
        await subscribe()
        return true
      }
    } catch (err) {
      console.warn('Push permission request failed:', err)
    }
    return false
  }

  const subscribe = async () => {
    let sub
    try {
      const reg = await navigator.serviceWorker.ready
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const { error } = await supabase
        .from('users')
        .update({ push_subscription: sub.toJSON() })
        .eq('id', userId)

      if (error) {
        console.error('Failed to save push subscription:', error.message)
        // Roll back the browser-side subscription so we don't leak an
        // endpoint the server will never push to.
        try { await sub.unsubscribe() } catch {}
        return
      }
      setSubscribed(true)
    } catch (err) {
      console.error('Push subscription failed:', err)
      if (sub) {
        try { await sub.unsubscribe() } catch {}
      }
    }
  }

  const sendPushNotification = async (householdId, changedByUserId, action, itemName) => {
    try {
      await authFetch('/.netlify/functions/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household_id: householdId,
          changed_by_user_id: changedByUserId,
          action,
          item_name: itemName,
        }),
      })
    } catch {
      // Non-critical, fail silently
    }
  }

  return { permission, subscribed, requestPermission, sendPushNotification }
}
