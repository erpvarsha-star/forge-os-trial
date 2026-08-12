import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'forgeos.deviceId'

/**
 * A stable per-install device identifier, used by the buddy-punching check on
 * check-in (same device, two different employees, same day).
 *
 * ⚠ REPLACES `Constants.deviceId || Constants.sessionId`, which made that
 * check dead code. `Constants.deviceId` was removed from Expo years before
 * SDK 51, so it is always undefined and the expression always fell through to
 * `sessionId` — which is regenerated every time the app launches. Every
 * check-in therefore wrote a brand-new device_id, so the lookup for "another
 * employee who used this device today" could never match, and no buddy-device
 * flag has ever been raised.
 *
 * Persisted in AsyncStorage, so it survives app restarts. It resets on
 * reinstall or "clear data", which is the honest limit of doing this without
 * a native device-id module: someone determined to defeat the check can, but
 * the casual "here, punch me in on your phone" case is caught, and that is
 * what this check is actually for.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY)
  if (existing) return existing

  const id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
  await AsyncStorage.setItem(KEY, id)
  return id
}
