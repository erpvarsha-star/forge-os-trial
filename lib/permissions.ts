import { BarCodeScanner } from 'expo-barcode-scanner'
import * as Location from 'expo-location'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

export const PERMISSIONS_DONE_KEY = 'app.permissionsRequested'

/**
 * Request all permissions the app needs in a single upfront sequence.
 *
 * Called from the permissions-onboarding screen on first install so employees
 * see one clear explanation instead of surprise system dialogs mid-flow.
 * Each permission request is wrapped independently — one denial never blocks
 * the others, and a total failure never blocks app use.
 *
 * The same permissions are also requested lazily at point of use (GPS on
 * check-in, camera when the QR modal opens, notifications in
 * registerForPushNotificationsAsync) as a safety net; those calls resolve
 * immediately when already granted.
 */
export async function requestAllPermissions(): Promise<void> {
  // Location — GPS check-in and check-out
  try {
    await Location.requestForegroundPermissionsAsync()
  } catch {}

  // Camera — QR scanner and 5S photo submissions
  try {
    await BarCodeScanner.requestPermissionsAsync()
  } catch {}

  // Notifications — shift reminders, leave/advance status, HR alerts
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E65C00',
      })
    }
    await Notifications.requestPermissionsAsync()
  } catch {}
}
