/**
 * Browser push notifications helper.
 * Requests permission on first call, then shows notifications.
 */

let permissionGranted = false

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') {
    permissionGranted = true
    return true
  }
  if (Notification.permission === 'denied') return false

  const result = await Notification.requestPermission()
  permissionGranted = result === 'granted'
  return permissionGranted
}

export function showNotification(title: string, options?: { body?: string; icon?: string; tag?: string }) {
  if (!permissionGranted && Notification.permission !== 'granted') return

  try {
    new Notification(title, {
      body: options?.body,
      icon: options?.icon ?? '/favicon.ico',
      tag: options?.tag,
      silent: false,
    })
  } catch {
    // Fallback for contexts where Notification constructor fails
  }
}
