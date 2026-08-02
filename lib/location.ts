import * as Location from "expo-location";
import { supabase } from "./supabase";

export interface PlantConfig {
  id: string;
  lat: number;
  lng: number;
  geofence_radius_meters: number;
  name: string;
}

// plant_config is a key-value table (config_key, config_value), not a
// single flat row — read the specific keys this app needs and assemble them.
export async function getPlantConfig(): Promise<PlantConfig | null> {
  const { data, error } = await supabase
    .from("plant_config")
    .select("config_key, config_value")
    .in("config_key", ["plant_code", "gps_lat", "gps_lng", "geofence_radius_meters", "plant_name"]);

  if (error || !data || data.length === 0) return null;

  const values: Record<string, any> = {};
  data.forEach((row: { config_key: string; config_value: any }) => { values[row.config_key] = row.config_value; });

  if (values.gps_lat === undefined || values.gps_lng === undefined) return null;

  return {
    id: values.plant_code ?? "PLANT",
    lat: Number(values.gps_lat),
    lng: Number(values.gps_lng),
    geofence_radius_meters: Number(values.geofence_radius_meters ?? 100),
    name: values.plant_name ?? "",
  };
}

export async function requestLocationPermissions(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return null;
  return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function isWithinGeofence() {
  const plantConfig = await getPlantConfig();
  const location = await getCurrentLocation();
  if (!plantConfig || !location) {
    return { inside: false, distance: Infinity, location, plantConfig };
  }
  const distance = calculateDistance(
    location.coords.latitude, location.coords.longitude,
    plantConfig.lat, plantConfig.lng
  );
  return {
    inside: distance <= plantConfig.geofence_radius_meters,
    distance, location, plantConfig,
  };
}