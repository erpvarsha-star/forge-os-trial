import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Registers this device for push notifications. Never throws: push is a
 * nice-to-have, but this runs on the login path (app/(auth)/login.tsx) right
 * before the post-login redirect, so anything thrown here would strand the
 * user on a spinning login button *after* their OTP already succeeded.
 *
 * That is not hypothetical — in a standalone APK (as opposed to Expo Go)
 * getExpoPushTokenAsync() requires an EAS projectId. app.json had none until
 * 11 Aug, so this threw "No projectId found" for every employee and
 * push_tokens stayed permanently empty.
 *
 * The projectId is now set (app.json extra.eas.projectId), so token
 * registration can succeed. Android DELIVERY additionally requires FCM
 * credentials on the Expo project — see CLAUDE.md. Until those exist a token
 * may be issued but pushes will not arrive, which is exactly why this stays
 * non-throwing: an incomplete push setup must never block login.
 */
export async function registerForPushNotificationsAsync(userId: string) {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      return null
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E65C00',
      })
    }

    // onConflict must name user_id: push_tokens' primary key is `id` (which
    // we never send), so the default conflict target never matches and the
    // upsert degrades into an INSERT that trips the `unique (user_id)`
    // constraint on every login after the first, leaving a stale token.
    await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    return token
  } catch (err) {
    console.warn('push registration skipped:', err)
    return null
  }
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
