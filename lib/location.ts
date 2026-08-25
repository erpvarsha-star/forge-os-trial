import * as Location from 'expo-location'
import { supabase } from './supabase'

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

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  })
  return location
}

export function isInsideGeofence(
  userLat: number,
  userLng: number,
  plantLat: number,
  plantLng: number,
  radiusMeters: number
): boolean {
  const R = 6371000
  const dLat = ((plantLat - userLat) * Math.PI) / 180
  const dLng = ((plantLng - userLng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((userLat * Math.PI) / 180) *
      Math.cos((plantLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  return distance <= radiusMeters
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
