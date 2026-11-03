import * as Location from 'expo-location';

/**
 * Default geofence radius in meters.
 * Driver must be within this distance from the assigned pickup/facility coordinates to check in.
 */
export const GEOFENCE_RADIUS_METERS = 200;

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude?: number | null;
  timestamp?: number;
}

export interface GeofenceResult {
  isWithinGeofence: boolean;
  distanceMeters: number;
  geofenceRadiusMeters: number;
  driverCoords: GeoCoordinates;
  targetCoords: { latitude: number; longitude: number };
}

/**
 * Calculates the great-circle distance between two geographic coordinates
 * on Earth using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 in degrees
 * @param lon1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lon2 Longitude of point 2 in degrees
 * @returns Distance in meters (rounded to nearest meter)
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return Infinity;
  }

  const R = 6371000; // Earth's mean radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Requests location permissions and retrieves the driver's current GPS position.
 * Handles disabled services, permission denial, and GPS timeouts.
 */
export async function getCurrentDriverLocation(): Promise<GeoCoordinates> {
  // 1. Verify device location services are enabled
  try {
    const isServiceEnabled = await Location.hasServicesEnabledAsync();
    if (!isServiceEnabled) {
      throw new Error(
        'Device GPS/Location services are disabled. Please enable Location in your device settings to proceed with check-in.'
      );
    }
  } catch (error: any) {
    if (error.message?.includes('Device GPS')) {
      throw error;
    }
    // Continue in case hasServicesEnabledAsync throws on certain platforms
  }

  // 2. Check and request location permission
  const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Location.requestForegroundPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error(
      'Location permission was denied. Location access is strictly required to verify you have reached the assigned facility.'
    );
  }

  // 3. Acquire high-accuracy position with fallback
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? null,
      altitude: location.coords.altitude ?? null,
      timestamp: location.timestamp,
    };
  } catch (posError: any) {
    // If high-accuracy times out, try balanced accuracy as fallback
    try {
      const fallbackLoc = await Location.getLastKnownPositionAsync();
      if (fallbackLoc && fallbackLoc.coords) {
        return {
          latitude: fallbackLoc.coords.latitude,
          longitude: fallbackLoc.coords.longitude,
          accuracy: fallbackLoc.coords.accuracy ?? null,
          altitude: fallbackLoc.coords.altitude ?? null,
          timestamp: fallbackLoc.timestamp,
        };
      }
    } catch {
      // Fallback failed
    }

    throw new Error(
      `Unable to obtain accurate GPS fix: ${posError?.message || 'GPS signal unavailable'}. Ensure you are outdoors or near a window with clear sky view.`
    );
  }
}

/**
 * Checks whether the driver is within the required geofence radius of the target coordinates.
 */
export function checkGeofence(
  driverCoords: GeoCoordinates,
  targetLat: number,
  targetLng: number,
  geofenceRadiusMeters: number = GEOFENCE_RADIUS_METERS
): GeofenceResult {
  const distance = calculateDistanceMeters(
    driverCoords.latitude,
    driverCoords.longitude,
    targetLat,
    targetLng
  );

  return {
    isWithinGeofence: distance <= geofenceRadiusMeters,
    distanceMeters: distance,
    geofenceRadiusMeters,
    driverCoords,
    targetCoords: { latitude: targetLat, longitude: targetLng },
  };
}

