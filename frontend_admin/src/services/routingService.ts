/**
 * Centralized Road Routing Service for Pharmatrix Admin Control Tower
 * Connects to OSRM (Open Source Routing Machine) or configured routing provider
 * to retrieve real road-following driving geometry, road distance, and travel duration.
 */

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface RoadRouteGeometry {
  coordinates: [number, number][]; // [lat, lng] array formatted for Leaflet polyline
  distanceKm: number;
  durationMin: number;
  source: 'OSRM';
  waypointsCount: number;
}

export interface MultiVehicleRoadRouteResult {
  vehicleIndex: number;
  roadGeometry: [number, number][] | null;
  roadDistanceKm?: number;
  roadDurationMin?: number;
  error?: string;
  source?: 'OSRM';
}

export const OSRM_DEFAULT_BASE_URL = 'https://router.project-osrm.org';

/**
 * Returns the configured base URL for OSRM driving routes.
 */
export function getRoutingBaseUrl(): string {
  const envUrl =
    (import.meta.env.VITE_OSRM_URL as string | undefined) ||
    (import.meta.env.VITE_ROUTING_API_URL as string | undefined);
  return (envUrl || OSRM_DEFAULT_BASE_URL).replace(/\/+$/, '');
}

// In-memory geometry cache to avoid duplicate API requests across renders and layer toggles
const routeGeometryCache = new Map<string, RoadRouteGeometry>();

/**
 * Generates a stable cache key for a sequence of waypoints.
 */
function generateCacheKey(profile: string, points: LatLngPoint[]): string {
  const coordParts = points
    .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    .join(';');
  return `${profile}:${coordParts}`;
}

/**
 * Fetches actual driving route geometry from OSRM following the real road network.
 * Returns coordinates as [lat, lng][] suitable for Leaflet L.polyline.
 */
export async function fetchRoadRoute(
  waypoints: LatLngPoint[],
  options: {
    timeoutMs?: number;
    profile?: string;
    baseUrl?: string;
  } = {}
): Promise<RoadRouteGeometry> {
  const { timeoutMs = 12000, profile = 'driving', baseUrl = getRoutingBaseUrl() } = options;

  // Validate waypoints
  if (!waypoints || waypoints.length < 2) {
    throw new Error('At least 2 waypoints (origin and destination) are required for road routing.');
  }

  for (const wp of waypoints) {
    if (
      typeof wp.lat !== 'number' ||
      typeof wp.lng !== 'number' ||
      isNaN(wp.lat) ||
      isNaN(wp.lng) ||
      wp.lat < -90 ||
      wp.lat > 90 ||
      wp.lng < -180 ||
      wp.lng > 180
    ) {
      throw new Error(`Invalid GPS waypoint coordinates encountered: lat=${wp.lat}, lng=${wp.lng}`);
    }
  }

  const cacheKey = generateCacheKey(profile, waypoints);
  const cached = routeGeometryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // OSRM requires: longitude,latitude;longitude,latitude...
  const coordString = waypoints
    .map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`)
    .join(';');

  const url = `${baseUrl}/route/v1/${profile}/${coordString}?overview=full&geometries=geojson&continue_straight=false&steps=false`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `OSRM routing service responded with status ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      const msg = data.message || data.code || 'No route found between waypoints';
      throw new Error(`OSRM routing failed: ${msg}`);
    }

    const route = data.routes[0];
    const geojsonCoords: [number, number][] = route.geometry?.coordinates || [];

    if (geojsonCoords.length === 0) {
      throw new Error('OSRM returned empty geometry for the requested road route.');
    }

    // Convert GeoJSON [longitude, latitude] to Leaflet [latitude, longitude]
    const leafletCoords: [number, number][] = geojsonCoords.map(([lon, lat]) => [lat, lon]);

    const result: RoadRouteGeometry = {
      coordinates: leafletCoords,
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMin: Number((route.duration / 60).toFixed(1)),
      source: 'OSRM',
      waypointsCount: waypoints.length,
    };

    routeGeometryCache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Road routing request timed out after ${timeoutMs}ms.`);
    }
    throw err;
  }
}

/**
 * Calculates road-following route geometries for multiple vehicles simultaneously.
 * Each vehicle route connects Depot -> Stop 1 -> Stop 2 -> ... -> Depot.
 */
export async function fetchMultiVehicleRoadRoutes(
  depot: LatLngPoint,
  routes: Array<{
    vehicleIndex: number;
    vehicleLabel?: string;
    stops: LatLngPoint[];
  }>
): Promise<MultiVehicleRoadRouteResult[]> {
  const promises = routes.map(async (r): Promise<MultiVehicleRoadRouteResult> => {
    if (!r.stops || r.stops.length === 0) {
      return {
        vehicleIndex: r.vehicleIndex,
        roadGeometry: null,
      };
    }

    // Full loop: Warehouse -> Stop 1 -> Stop 2 -> ... -> Stop N -> Warehouse
    const waypoints: LatLngPoint[] = [
      { lat: depot.lat, lng: depot.lng },
      ...r.stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      { lat: depot.lat, lng: depot.lng },
    ];

    try {
      const roadData = await fetchRoadRoute(waypoints);
      return {
        vehicleIndex: r.vehicleIndex,
        roadGeometry: roadData.coordinates,
        roadDistanceKm: roadData.distanceKm,
        roadDurationMin: roadData.durationMin,
        source: 'OSRM',
      };
    } catch (error: any) {
      console.error(
        `Failed to fetch road geometry for vehicle ${r.vehicleLabel ?? r.vehicleIndex}:`,
        error
      );
      return {
        vehicleIndex: r.vehicleIndex,
        roadGeometry: null,
        error: error.message || 'Road routing service failed',
      };
    }
  });

  return Promise.all(promises);
}

/**
 * Clears the in-memory route geometry cache if needed (e.g., on reset).
 */
export function clearRoutingCache(): void {
  routeGeometryCache.clear();
}

