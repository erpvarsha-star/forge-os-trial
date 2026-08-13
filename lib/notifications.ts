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
 * SINCE 13 AUG this asks Android for its NATIVE FCM token rather than an
 * Expo one. Expo's push service is only a relay to FCM, and using it requires
 * uploading credentials through a dashboard wizard that demands an Android
 * upload keystore this project does not have — our APKs are built by GitHub
 * Actions and signed with the debug keystore, never by EAS. Going straight to
 * FCM removes that dependency entirely: the server sends via
 * supabase/functions/_shared/fcm.ts using a Firebase service account.
 *
 * The Expo path is kept as a fallback for anything that is not Android, and
 * the server still accepts both token shapes, so devices registered before
 * this change keep working without a forced reinstall.
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

    // The channel must exist BEFORE a notification arrives, or Android drops
    // it silently. fcm.ts sends with channel_id 'default', so the two names
    // have to agree — they are matched deliberately, not by luck.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E65C00',
      })
    }

    let token: string | null = null

    if (Platform.OS === 'android') {
      // Native FCM registration token — what fcm.ts sends to directly.
      try {
        const device = await Notifications.getDevicePushTokenAsync()
        token = typeof device.data === 'string' ? device.data : null
      } catch (err) {
        console.warn('native FCM token unavailable, falling back to Expo:', err)
      }
    }

    // Fallback: Expo's relay. Still correct — the server routes by token shape
    // — and the only path available on anything that is not Android.
    if (!token) {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
      token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data
    }

    if (!token) return null

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
 * Alerts every employee holding `role` — used for client-triggered alerts
 * such as fraud detection, where there is no backend process to fan out from.
 *
 * ⚠ REWRITTEN 13 AUG. This used to POST straight to Expo's push endpoint from
 * the device. That silently stopped working the moment Android started
 * registering native FCM tokens instead of Expo ones: Expo's API accepts the
 * request, finds nothing it recognises, and returns success. A push path that
 * reports success while delivering nothing is worse than one that fails.
 *
 * It also could not be fixed in place. Sending to FCM directly needs the
 * Firebase service account, which is a secret and must never be shipped in an
 * APK. So the send moves server-side: this now calls the send-push-notification
 * edge function, which writes the in-app notification rows AND routes each
 * token to Expo or FCM by shape.
 *
 * Still non-throwing. This is called from fraud paths during check-in, and a
 * failed alert must never block an employee from clocking in.
 */
export async function notifyEmployeesByRole(role: string, title: string, body: string, data?: Record<string, unknown>) {
  const { data: recipients } = await supabase.from('employees').select('id').eq('role', role).eq('is_active', true)
  const employeeIds = (recipients ?? []).map((r: { id: string }) => r.id)
  if (employeeIds.length === 0) return

  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        employeeIds,
        type: (data?.type as string) ?? 'alert',
        title,
        body,
        relatedEntityType: data?.relatedEntityType as string | undefined,
        relatedEntityId: data?.relatedEntityId as string | undefined,
      },
    })
    if (error) console.error('notifyEmployeesByRole failed', error)
  } catch (err) {
    console.error('notifyEmployeesByRole failed', err)
  }
}
