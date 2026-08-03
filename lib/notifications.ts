import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotificationsAsync(userId: string) {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    return null
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E65C00',
    })
  }

  await supabase.from('push_tokens').upsert({
    user_id: userId,
    token,
    platform: Platform.OS,
    updated_at: new Date().toISOString(),
  })

  return token
}

export async function removePushToken(userId: string) {
  await supabase.from('push_tokens').delete().eq('user_id', userId)
}

export type NotificationType =
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'ADVANCE_APPROVED'
  | 'ADVANCE_REJECTED'
  | 'TASK_ASSIGNED'
  | 'TASK_OVERDUE'
  | 'SHIFT_REMINDER'
  | '5S_CHALLENGE'
  | '5S_VERIFIED'
  | 'FRAUD_ALERT'
  | 'MRM_REMINDER'
  | 'SCORE_UPDATED'

/**
 * Sends an Expo push notification to every employee holding `role`, using
 * whatever device tokens they've registered in `push_tokens`. Used for
 * server-less alerts (e.g. fraud detection) where there's no backend
 * process to fan the notification out from.
 */
export async function notifyEmployeesByRole(role: string, title: string, body: string, data?: Record<string, unknown>) {
  const { data: recipients } = await supabase.from('employees').select('id').eq('role', role).eq('is_active', true)
  const recipientIds = (recipients ?? []).map((r: { id: string }) => r.id)
  if (recipientIds.length === 0) return

  const { data: tokens } = await supabase.from('push_tokens').select('token').in('user_id', recipientIds)
  const messages = (tokens ?? [])
    .filter((t: { token: string }) => !!t.token)
    .map((t: { token: string }) => ({ to: t.token, sound: 'default', title, body, data: data ?? {} }))
  if (messages.length === 0) return

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    })
  } catch (err) {
    console.error('notifyEmployeesByRole push failed', err)
  }
}
