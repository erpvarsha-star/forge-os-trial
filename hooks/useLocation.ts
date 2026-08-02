import { useState, useCallback } from "react";
import { isWithinGeofence } from "@/lib/location";

export function useLocationCheck() {
  const [checking, setChecking] = useState(false);
  const [locationData, setLocationData] = useState<{ inside: boolean; distance: number; error?: string } | null>(null);
  const checkLocation = useCallback(async () => {
    setChecking(true);
    try {
      const result = await isWithinGeofence();
      setLocationData({ inside: result.inside, distance: result.distance });
      return result;
    } catch (error) {
      setLocationData({ inside: false, distance: Infinity, error: "Location check failed" });
      return null;
    } finally { setChecking(false); }
  }, []);
  return { checking, locationData, checkLocation };
}