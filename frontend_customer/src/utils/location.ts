import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

export type LocationPermissionStatusType =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'permanently_denied'
  | 'services_disabled';

export type LocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'PERMISSION_PERMANENTLY_DENIED'
  | 'SERVICES_DISABLED'
  | 'TIMEOUT'
  | 'UNAVAILABLE';

export interface LocationPermissionInfo {
  status: LocationPermissionStatusType;
  canAskAgain: boolean;
  servicesEnabled: boolean;
}

export interface DetectedAddress {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  buildingName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  formattedAddress: string;
  geocodingFailed: boolean;
}

export type LocationDetectionOutcome =
  | {
      ok: true;
      data: DetectedAddress;
      permission: LocationPermissionInfo;
    }
  | {
      ok: false;
      errorCode: LocationErrorCode;
      message: string;
      permission: LocationPermissionInfo;
    };

/**
 * Inspects foreground location permission state without prompting the user.
 * Safe to call when rendering UI state; never triggers a permission dialog.
 */
export async function getQuietLocationPermissionState(): Promise<LocationPermissionInfo> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    let servicesEnabled = true;
    try {
      servicesEnabled = await Location.hasServicesEnabledAsync();
    } catch {
      servicesEnabled = true;
    }

    if (perm.granted) {
      return {
        status: servicesEnabled ? 'granted' : 'services_disabled',
        canAskAgain: perm.canAskAgain ?? true,
        servicesEnabled,
      };
    }

    if (perm.status === Location.PermissionStatus.DENIED) {
      return {
        status: perm.canAskAgain === false ? 'permanently_denied' : 'denied',
        canAskAgain: perm.canAskAgain ?? false,
        servicesEnabled,
      };
    }

    return {
      status: 'undetermined',
      canAskAgain: perm.canAskAgain ?? true,
      servicesEnabled,
    };
  } catch {
    return {
      status: 'undetermined',
      canAskAgain: true,
      servicesEnabled: true,
    };
  }
}

/**
 * Opens the operating system settings screen for this app so the user can
 * grant location permission after permanent denial.
 */
export async function openDeviceLocationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:').catch(() => {});
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Reverse-geocodes GPS coordinates into structured address fields.
 * Uses native Expo reverse geocoding first, with OpenStreetMap Nominatim fallback.
 * Never throws; if reverse geocoding is unavailable, returns coordinates with geocodingFailed: true.
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
  accuracy: number | null = null
): Promise<DetectedAddress> {
  const roundedLat = Number(latitude.toFixed(6));
  const roundedLng = Number(longitude.toFixed(6));

  // 1. Try native Expo Location reverse geocoding first (Android / iOS)
  if (Platform.OS !== 'web') {
    try {
      const results = await withTimeout(
        Location.reverseGeocodeAsync({ latitude: roundedLat, longitude: roundedLng }),
        7000,
        'GEOCODE_TIMEOUT'
      );

      if (results && results.length > 0) {
        const place = results[0];
        const streetParts = [place.streetNumber, place.street].filter(Boolean).join(' ').trim();
        const districtPart = (place.district || place.subregion || '').trim();
        const namePart = (place.name || '').trim();

        const addressLine1 =
          streetParts ||
          (namePart && namePart !== place.city ? namePart : '') ||
          districtPart ||
          '';

        const addressLine2 =
          districtPart && districtPart !== addressLine1
            ? districtPart
            : namePart && namePart !== addressLine1 && namePart !== place.city
              ? namePart
              : '';

        const city = (place.city || place.subregion || '').trim();
        const state = (place.region || '').trim();
        const postalCode = (place.postalCode || '').replace(/\s+/g, '').trim();

        const formattedParts = [
          namePart && namePart !== streetParts ? namePart : null,
          streetParts || null,
          districtPart && districtPart !== streetParts ? districtPart : null,
          city || null,
          state || null,
          postalCode || null,
        ].filter(Boolean);

        if (addressLine1 || city || state || postalCode) {
          return {
            latitude: roundedLat,
            longitude: roundedLng,
            accuracy,
            buildingName:
              namePart && namePart !== streetParts && !/^\d+$/.test(namePart) ? namePart : '',
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            formattedAddress:
              formattedParts.join(', ') || `${roundedLat.toFixed(5)}, ${roundedLng.toFixed(5)}`,
            geocodingFailed: false,
          };
        }
      }
    } catch {
      // Fall through to Nominatim fallback
    }
  }

  // 2. Fallback to OpenStreetMap Nominatim reverse geocoding
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${roundedLat}&lon=${roundedLng}&addressdetails=1`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'PharmatrixCustomerApp/1.0',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (response.ok) {
      const json = await response.json();
      const addr = json?.address || {};
      const building =
        addr.amenity ||
        addr.shop ||
        addr.building ||
        addr.office ||
        addr.healthcare ||
        json?.name ||
        '';
      const road = [addr.house_number, addr.road || addr.pedestrian || addr.residential]
        .filter(Boolean)
        .join(' ')
        .trim();
      const locality =
        addr.suburb ||
        addr.neighbourhood ||
        addr.quarter ||
        addr.city_district ||
        addr.village ||
        '';
      const city =
        addr.city ||
        addr.town ||
        addr.municipality ||
        addr.county ||
        addr.state_district ||
        '';
      const state = addr.state || '';
      const postalCode = (addr.postcode || '').replace(/\s+/g, '');

      const addressLine1 = road || locality || building || '';
      const addressLine2 = locality && locality !== addressLine1 ? locality : '';

      const formattedParts = [building, road, locality, city, state, postalCode].filter(Boolean);

      if (addressLine1 || city || state || postalCode) {
        return {
          latitude: roundedLat,
          longitude: roundedLng,
          accuracy,
          buildingName: building && building !== addressLine1 ? building : '',
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          formattedAddress:
            formattedParts.join(', ') ||
            json?.display_name ||
            `${roundedLat.toFixed(5)}, ${roundedLng.toFixed(5)}`,
          geocodingFailed: false,
        };
      }
    }
  } catch {
    // Geocoding failed or offline
  }

  return {
    latitude: roundedLat,
    longitude: roundedLng,
    accuracy,
    buildingName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    formattedAddress: `GPS Coordinates (${roundedLat.toFixed(5)}, ${roundedLng.toFixed(5)})`,
    geocodingFailed: true,
  };
}

/**
 * Requests foreground location permission when the user explicitly taps
 * "Use Current Location", fetches GPS coordinates, and reverse-geocodes the address.
 * Handles all permission and GPS failure modes cleanly without throwing.
 */
export async function requestLocationAndDetectAddress(): Promise<LocationDetectionOutcome> {
  try {
    // 1. Request foreground permission only
    const perm = await Location.requestForegroundPermissionsAsync();

    if (!perm.granted) {
      const isPermanent = perm.canAskAgain === false;
      const permInfo: LocationPermissionInfo = {
        status: isPermanent ? 'permanently_denied' : 'denied',
        canAskAgain: perm.canAskAgain ?? false,
        servicesEnabled: true,
      };

      return {
        ok: false,
        errorCode: isPermanent ? 'PERMISSION_PERMANENTLY_DENIED' : 'PERMISSION_DENIED',
        message: isPermanent
          ? 'Location permission is turned off for Pharmatrix. Enable Location in your device settings or enter your business address manually below.'
          : 'Location permission was declined. You can grant permission to auto-detect your address, or enter your business address manually below.',
        permission: permInfo,
      };
    }

    // 2. Check if device GPS / Location services are enabled
    let servicesEnabled = true;
    try {
      servicesEnabled = await Location.hasServicesEnabledAsync();
    } catch {
      servicesEnabled = true;
    }

    if (!servicesEnabled) {
      return {
        ok: false,
        errorCode: 'SERVICES_DISABLED',
        message:
          'Device location services (GPS) are currently turned off. Please enable Location / GPS on your device and try again, or enter your address manually.',
        permission: {
          status: 'services_disabled',
          canAskAgain: true,
          servicesEnabled: false,
        },
      };
    }

    // 3. Acquire current GPS position with fallback
    let position: Location.LocationObject | null = null;
    try {
      position = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        10000,
        'GPS_TIMEOUT'
      );
    } catch {
      try {
        position = await Location.getLastKnownPositionAsync({
          maxAge: 300000,
        });
      } catch {
        position = null;
      }
    }

    if (
      !position ||
      typeof position.coords?.latitude !== 'number' ||
      typeof position.coords?.longitude !== 'number'
    ) {
      return {
        ok: false,
        errorCode: 'TIMEOUT',
        message:
          'Could not acquire a GPS signal indoors or within the time limit. Please move near a window and retry, or enter your business address manually.',
        permission: {
          status: 'granted',
          canAskAgain: true,
          servicesEnabled: true,
        },
      };
    }

    // 4. Reverse-geocode into structured address fields
    const detected = await reverseGeocodeCoordinates(
      position.coords.latitude,
      position.coords.longitude,
      position.coords.accuracy ?? null
    );

    return {
      ok: true,
      data: detected,
      permission: {
        status: 'granted',
        canAskAgain: true,
        servicesEnabled: true,
      },
    };
  } catch {
    return {
      ok: false,
      errorCode: 'UNAVAILABLE',
      message:
        'Unable to access device location at this moment. Please enter your business address manually below.',
      permission: {
        status: 'undetermined',
        canAskAgain: true,
        servicesEnabled: true,
      },
    };
  }
}

