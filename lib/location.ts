import * as Location from 'expo-location'
import { supabase } from './supabase'
import { serverNowMs } from './serverClock'

export interface PlantConfig {
  id: string
  plant_name: string
  latitude: number
  longitude: number
  geofence_radius_meters: number
  qr_secret_salt: string
}

// plant_config is a key-value table (config_key, config_value), not a
// single flat row — read every row and assemble a lookup keyed by config_key.
export async function getPlantConfig(): Promise<PlantConfig | null> {
  const { data, error } = await supabase
    .from('plant_config')
    .select('config_key, config_value')

  if (error || !data) return null

  const config = Object.fromEntries(
    data.map((row: { config_key: string; config_value: any }) => [row.config_key, row.config_value])
  )

  const plantLat = config['plant_lat']
  const plantLng = config['plant_lng']
  const geofenceRadius = config['geofence_radius_meters']

  if (plantLat === undefined || plantLng === undefined) return null

  return {
    id: config['plant_code'] ?? 'PLANT',
    plant_name: config['plant_name'] ?? '',
    latitude: Number(plantLat),
    longitude: Number(plantLng),
    geofence_radius_meters: Number(geofenceRadius ?? 100),
    qr_secret_salt: config['qr_secret_salt'] ?? '',
  }
}

export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return null

  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    })
  } catch {
    return null
  }
}

export type CheckInLocationFailure = 'permission' | 'services_off' | 'no_fix'
export type CheckInLocationResult =
  | { ok: true; location: Location.LocationObject }
  | { ok: false; reason: CheckInLocationFailure }

const GOOD_FIX_ACCURACY_M = 20
const FIX_WINDOW_MS = 12000

// Samples the GPS for up to 12 s and keeps the most accurate fix — a single
// getCurrentPositionAsync often returns a coarse first fix (or hangs) inside
// the steel-frame shops. Always releases the subscription.
function sampleBestFix(maxMs: number): Promise<Location.LocationObject | null> {
  return new Promise((resolve) => {
    let best: Location.LocationObject | null = null
    let sub: Location.LocationSubscription | null = null
    let done = false
    const timer = setTimeout(() => finish(), maxMs)
    function finish() {
      if (done) return
      done = true
      clearTimeout(timer)
      try {
        sub?.remove()
      } catch {}
      resolve(best)
    }
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 },
      (loc) => {
        const acc = loc.coords.accuracy ?? Infinity
        if (!best || acc < (best.coords.accuracy ?? Infinity)) best = loc
        if (acc <= GOOD_FIX_ACCURACY_M) finish()
      }
    )
      .then((s) => {
        sub = s
        if (done) {
          try {
            s.remove()
          } catch {}
        }
      })
      .catch(() => finish())
  })
}

export async function getCheckInLocation(): Promise<CheckInLocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return { ok: false, reason: 'permission' }
    if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'services_off' }

    const fix = await sampleBestFix(FIX_WINDOW_MS)
    if (fix) return { ok: true, location: fix }

    const last = await Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 100 })
    if (last) return { ok: true, location: last }
    return { ok: false, reason: 'no_fix' }
  } catch {
    return { ok: false, reason: 'no_fix' }
  }
}

function distanceBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isInsideGeofence(
  userLat: number,
  userLng: number,
  plantLat: number,
  plantLng: number,
  radiusMeters: number
): boolean {
  return distanceBetween(userLat, userLng, plantLat, plantLng) <= radiusMeters
}

export interface PlantLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  radius_meters: number
}

// PATCH_21 — multi-point geofencing (11 named campus locations: shops, the
// office, the raw material yard). The campus is one contiguous site, so a
// check-in is valid near ANY of these points, not tied to the employee's own
// department. Returns [] until PATCH_22 is run with real coordinates
// (Google Maps links resolved outside the app — see PENDING.md), and every
// caller falls back to the single-point plant_config geofence when this is
// empty, so an unrun PATCH_22 changes nothing about current check-in
// behaviour.
export async function getPlantLocations(): Promise<PlantLocation[]> {
  const { data, error } = await supabase
    .from('plant_locations')
    .select('id, name, latitude, longitude, radius_meters')
    .eq('is_active', true)

  if (error || !data) return []
  return data as PlantLocation[]
}

export function isInsideAnyGeofence(
  userLat: number,
  userLng: number,
  locations: PlantLocation[]
): boolean {
  return locations.some((loc) => isInsideGeofence(userLat, userLng, loc.latitude, loc.longitude, loc.radius_meters))
}

// Inside steel shops a true-inside fix can read 30-80 m off. The reported
// accuracy is added to the radius, capped so a garbage fix can't pass from
// far away. Same cap is applied server-side in fraud-detector.
export const GPS_ACCURACY_TOLERANCE_MAX_M = 25

export function isWithinPlant(
  lat: number,
  lng: number,
  accuracyM: number | null | undefined,
  locations: PlantLocation[],
  plant: PlantConfig
): boolean {
  const acc = typeof accuracyM === 'number' && Number.isFinite(accuracyM) ? accuracyM : 0
  const tolerance = Math.min(Math.max(acc, 0), GPS_ACCURACY_TOLERANCE_MAX_M)
  if (locations.length > 0) {
    return locations.some((loc) => distanceBetween(lat, lng, loc.latitude, loc.longitude) <= loc.radius_meters + tolerance)
  }
  return distanceBetween(lat, lng, plant.latitude, plant.longitude) <= plant.geofence_radius_meters + tolerance
}

/**
 * Returns the current IST date string (YYYY-MM-DD) and 30-minute bucket
 * index (0–47). The QR value is `${plant.id}-${date}-${bucket}-${salt}`.
 *
 * A photo of the QR shared via WhatsApp is worthless after 30 minutes —
 * it will fail validation on all later scans that same day, and on any
 * future day entirely (date component changes).
 */
export function istQrKey(): { date: string; bucket: number } {
  // Server-corrected clock: a wrong phone clock must not shift the QR bucket.
  const now = serverNowMs() + 5.5 * 60 * 60 * 1000          // shift to IST
  const ist = new Date(now)
  const date = ist.toISOString().slice(0, 10)
  const minutesSinceMidnight = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  const bucket = Math.floor(minutesSinceMidnight / 30)    // 0–47
  return { date, bucket }
}

// Only the first 16 hex chars (64 bits) of the salt go into the QR itself —
// 6 Oct 2026, after "scans are taking 10 minutes" turned out to be the
// camera struggling to read the code, not GPS or server latency. The full
// value was plant_code(~7) + date(10) + bucket(2) + the FULL 48-char salt
// (PATCH_16) ≈ 70 characters, dense enough to need a larger QR version that
// a factory-floor phone camera reads slowly or not at all. A code that
// rotates every 30 minutes doesn't need the salt's full 192 bits of
// entropy — 64 is already far more than enough to resist guessing inside
// one 30-min window, and this shrinks the encoded string to ~38 characters.
const QR_SALT_CHARS = 16

export function buildQrValue(plant: PlantConfig): string {
  const { date, bucket } = istQrKey()
  const shortSalt = plant.qr_secret_salt.slice(0, QR_SALT_CHARS)
  return `${plant.id}-${date}-${bucket}-${shortSalt}`
}

// Accepts both salt lengths (APKs before/after 6 Oct differ) and the
// previous/next 30-min bucket (guard screen refresh lag, worker clock skew).
export function isValidGateQr(data: string, plant: PlantConfig): boolean {
  const salt = plant.qr_secret_salt
  if (!salt) return false
  const scanned = (data ?? '').trim()
  if (!scanned) return false

  const { date, bucket } = istQrKey()
  const DAY_MS = 24 * 60 * 60 * 1000
  const shiftDate = (days: number) =>
    new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

  const keys: { date: string; bucket: number }[] = [{ date, bucket }]
  keys.push(bucket === 0 ? { date: shiftDate(-1), bucket: 47 } : { date, bucket: bucket - 1 })
  keys.push(bucket === 47 ? { date: shiftDate(1), bucket: 0 } : { date, bucket: bucket + 1 })

  const salts = [salt.slice(0, QR_SALT_CHARS), salt]
  return keys.some((k) => salts.some((s) => scanned === `${plant.id}-${k.date}-${k.bucket}-${s}`))
}
