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
// single flat row — read the specific keys this app needs and assemble them.
export async function getPlantConfig(): Promise<PlantConfig | null> {
  const { data, error } = await supabase
    .from('plant_config')
    .select('config_key, config_value')
    .in('config_key', ['plant_code', 'plant_name', 'gps_lat', 'gps_lng', 'geofence_radius_meters', 'qr_secret_salt'])

  if (error || !data || data.length === 0) return null

  const values: Record<string, any> = {}
  data.forEach((row: { config_key: string; config_value: any }) => { values[row.config_key] = row.config_value })

  if (values.gps_lat === undefined || values.gps_lng === undefined) return null

  return {
    id: values.plant_code ?? 'PLANT',
    plant_name: values.plant_name ?? '',
    latitude: Number(values.gps_lat),
    longitude: Number(values.gps_lng),
    geofence_radius_meters: Number(values.geofence_radius_meters ?? 100),
    qr_secret_salt: values.qr_secret_salt ?? '',
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
