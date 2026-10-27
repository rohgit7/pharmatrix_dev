import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { TokenStorage } from './storage';
import {
  DriverMeResponse,
  DriverRouteResponse,
  LoginResponse,
  UserMeResponse,
  StartRouteResponse,
  ArriveStopResponse,
  VerifyQRResponse,
  VerifyOTPResponse,
  CompleteStopResponse,
  FailStopResponse,
  ProofUploadResponse,
  ProofUrlResponse,
  ApiErrorResponse,
  RequestOTPResponse,
  PickupVerificationResponse,
} from '@/types/api';

/**
 * Extracts host IP from Expo Metro packager when running in Expo Go or dev client.
 */
export function getAutoDetectedHostIp(): string | null {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
      (Constants as any).manifest?.debuggerHost;
    if (hostUri && typeof hostUri === 'string') {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  } catch {
    // Ignore extraction failure
  }
  return null;
}

// Resolve default Base URL
export function getDefaultApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const detectedIp = getAutoDetectedHostIp();

  // 1. Android Emulator: 10.0.2.2 is the official loopback alias to host machine
  if (Platform.OS === 'android' && !Device.isDevice) {
    if (envUrl && envUrl.includes('10.0.2.2')) {
      return envUrl;
    }
    return 'http://10.0.2.2:8000';
  }

  // 2. Physical device (Android or iOS): Requires reachable LAN IP of host machine
  // Uses port 8001 (Node relay which passes Windows Defender Firewall on Public Wi-Fi profiles)
  if (Device.isDevice) {
    if (detectedIp) {
      return `http://${detectedIp}:8001`;
    }
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') && !envUrl.includes('10.0.2.2')) {
      return envUrl;
    }
    return 'http://10.138.26.167:8001';
  }

  // 3. Web or iOS Simulator
  if (Platform.OS === 'web' || Platform.OS === 'ios') {
    if (envUrl && !envUrl.includes('10.0.2.2')) {
      return envUrl;
    }
    return 'http://localhost:8000';
  }

  // 4. Fallback to env URL or localhost
  return envUrl || 'http://localhost:8000';
}

export async function getEffectiveApiBaseUrl(): Promise<string> {
  const custom = await TokenStorage.getCustomApiBaseUrl();
  if (custom && custom.trim().length > 0) {
    let trimmed = custom.trim().replace(/\/+$/, '');

    // Safety check for physical devices: "localhost", "127.0.0.1", or "10.0.2.2" inside a physical phone
    // will always fail with Connection Refused! Auto-fix loopback to the host LAN IP.
    if (Device.isDevice) {
      const isLoopback =
        trimmed.includes('localhost') ||
        trimmed.includes('127.0.0.1') ||
        trimmed.includes('10.0.2.2');
      if (isLoopback) {
        const ip = getAutoDetectedHostIp() || '10.138.26.167';
        const port = trimmed.includes(':8000') ? '8001' : '8001';
        trimmed = `http://${ip}:${port}`;
        await TokenStorage.setCustomApiBaseUrl(trimmed);
      }
    }
    return trimmed;
  }
  return getDefaultApiBaseUrl().replace(/\/+$/, '');
}

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const errorJson = (await response.json()) as ApiErrorResponse;
    if (typeof errorJson.detail === 'string') {
      return errorJson.detail;
    }
    if (Array.isArray(errorJson.detail)) {
      return errorJson.detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
    }
    return `Server responded with status ${response.status}`;
  } catch {
    return response.statusText || `Request failed with status ${response.status}`;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = await getEffectiveApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const token = await TokenStorage.getAccessToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set Content-Type only if not already multipart/form-data
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, 20000); // 20s timeout

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        // If unauthorized, clean stored token
        await TokenStorage.clearTokens();
        const message = await parseErrorMessage(response);
        throw new ApiError(message || 'Invalid email or password. Please verify your credentials.', 401);
      }
      if (response.status === 403) {
        const message = await parseErrorMessage(response);
        throw new ApiError(message || 'Access denied: Restricted to authorized Pharmatrix drivers.', 403);
      }
      if (response.status === 404) {
        const message = await parseErrorMessage(response);
        throw new ApiError(message || 'Requested resource was not found.', 404);
      }
      if (response.status >= 500) {
        const message = await parseErrorMessage(response);
        throw new ApiError(message || 'Internal server error. Please contact dispatch or administrator.', response.status);
      }
      const message = await parseErrorMessage(response);
      throw new ApiError(message, response.status);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) {
      throw error;
    }

    const errMsg = String(error?.message || '');
    const isTimeout = didTimeout || error.name === 'AbortError' || errMsg.toLowerCase().includes('timeout');
    const isConnectionError =
      errMsg.toLowerCase().includes('canceled') ||
      errMsg.toLowerCase().includes('cancelled') ||
      errMsg.toLowerCase().includes('network request failed') ||
      errMsg.toLowerCase().includes('failed to fetch') ||
      errMsg.toLowerCase().includes('networkerror') ||
      errMsg.toLowerCase().includes('connection refused') ||
      error.name === 'TypeError';

    if (isTimeout || isConnectionError) {
      // Attempt automatic fallback port retry (e.g. switch between :8000 and :8001 on physical device)
      let fallbackUrl: string | null = null;
      if (baseUrl.includes(':8000')) {
        fallbackUrl = baseUrl.replace(':8000', ':8001');
      } else if (baseUrl.includes(':8001')) {
        fallbackUrl = baseUrl.replace(':8001', ':8000');
      }

      if (fallbackUrl) {
        try {
          const fbTarget = `${fallbackUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
          const fbController = new AbortController();
          const fbTimeout = setTimeout(() => fbController.abort(), 6000);
          const fbResponse = await fetch(fbTarget, {
            ...options,
            headers,
            signal: fbController.signal,
          });
          clearTimeout(fbTimeout);
          if (fbResponse.ok) {
            await TokenStorage.setCustomApiBaseUrl(fallbackUrl);
            if (fbResponse.status === 204) return {} as T;
            return (await fbResponse.json()) as T;
          }
        } catch {
          // Fallback failed, proceed to standard error below
        }
      }

      if (isTimeout) {
        throw new ApiError(
          `Request timed out after 20 seconds. If connecting over Wi-Fi, try switching to port 8001 (Wi-Fi Relay) at ${baseUrl.replace(':8000', ':8001')}.`,
          408
        );
      }

      throw new ApiError(
        `Cannot connect to backend server at ${baseUrl}. Ensure your phone is on the same Wi-Fi network. On physical phones, use port 8001 (Wi-Fi Relay) if Windows Firewall blocks port 8000.`,
        0
      );
    }

    throw new ApiError(
      error.message || `Network connection failed. Ensure backend API is accessible at ${baseUrl}.`,
      0
    );
  }
}

export const ApiClient = {
  checkHealth: async (targetUrl?: string): Promise<{ ok: boolean; status?: number; workingUrl?: string; error?: string }> => {
    const base = targetUrl ? targetUrl.trim().replace(/\/+$/, '') : await getEffectiveApiBaseUrl();

    const testSingle = async (url: string) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${url}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return { ok: res.ok, status: res.status, url };
      } catch (e: any) {
        return { ok: false, error: e.message || 'Connection failed', url };
      }
    };

    const first = await testSingle(base);
    if (first.ok) {
      return { ok: true, status: first.status, workingUrl: base };
    }

    // Auto test alternate port
    let altUrl: string | null = null;
    if (base.includes(':8000')) {
      altUrl = base.replace(':8000', ':8001');
    } else if (base.includes(':8001')) {
      altUrl = base.replace(':8001', ':8000');
    }

    if (altUrl) {
      const second = await testSingle(altUrl);
      if (second.ok) {
        await TokenStorage.setCustomApiBaseUrl(altUrl);
        return { ok: true, status: second.status, workingUrl: altUrl };
      }
    }

    return {
      ok: false,
      status: first.status,
      error: `Cannot reach server at ${base}. On physical phones, use port 8001 (Wi-Fi Relay).`,
    };
  },

  // Auth endpoints
  login: async (email: string, password: string): Promise<LoginResponse> => {
    return request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
  },

  getMe: async (): Promise<UserMeResponse> => {
    return request<UserMeResponse>('/api/auth/me', {
      method: 'GET',
    });
  },

  getDriverMe: async (): Promise<DriverMeResponse> => {
    return request<DriverMeResponse>('/api/admin/drivers/me', {
      method: 'GET',
    });
  },

  // Driver route endpoints
  getTodayRoute: async (): Promise<DriverRouteResponse> => {
    return request<DriverRouteResponse>('/api/driver/routes/today', {
      method: 'GET',
    });
  },

  startRoute: async (routeId: number): Promise<StartRouteResponse> => {
    return request<StartRouteResponse>(`/api/driver/routes/${routeId}/start`, {
      method: 'POST',
    });
  },

  arriveAtStop: async (
    routeId: number,
    stopId: number
  ): Promise<ArriveStopResponse> => {
    return request<ArriveStopResponse>(
      `/api/driver/routes/${routeId}/stops/${stopId}/arrive`,
      {
        method: 'POST',
      }
    );
  },

  scanPickupQr: async (
    routeId: number,
    stopId: number,
    qrToken: string
  ): Promise<VerifyQRResponse> => {
    return request<VerifyQRResponse>(
      `/api/driver/routes/${routeId}/stops/${stopId}/scan-qr`,
      {
        method: 'POST',
        body: JSON.stringify({ qr_token: qrToken }),
      }
    );
  },

  verifyPickupOtp: async (
    routeId: number,
    stopId: number,
    otp: string
  ): Promise<VerifyOTPResponse> => {
    return request<VerifyOTPResponse>(
      `/api/driver/routes/${routeId}/stops/${stopId}/verify-otp`,
      {
        method: 'POST',
        body: JSON.stringify({ otp }),
      }
    );
  },

  uploadCollectionProof: async (
    routeId: number,
    stopId: number,
    fileUri: string,
    fileName = 'proof.jpg',
    mimeType = 'image/jpeg'
  ): Promise<ProofUploadResponse> => {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      const res = await fetch(fileUri);
      const blob = await res.blob();
      formData.append('file', blob, fileName);
    } else {
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      } as any);
    }

    return request<ProofUploadResponse>(
      `/api/driver/routes/${routeId}/stops/${stopId}/proof`,
      {
        method: 'POST',
        body: formData,
      }
    );
  },

  getCollectionProofUrl: async (
    routeId: number,
    stopId: number
  ): Promise<ProofUrlResponse> => {
    return request<ProofUrlResponse>(
      `/api/driver/routes/${routeId}/stops/${stopId}/proof-url`,
      {
        method: 'GET',
      }
    );
  },

  completeStop: async (
    routeId: number,
    stopId: number,
    collectedWeightKg = 0,
    notes?: string | null
  ): Promise<CompleteStopResponse> => {
    return request<CompleteStopResponse>(
      `/api/driver/routes/${routeId}/stops/${stopId}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({
          collected_weight_kg: collectedWeightKg,
          notes: notes || null,
        }),
      }
    );
  },

  failStop: async (
    routeId: number,
    stopId: number,
    reason: string
  ): Promise<FailStopResponse> => {
    return request<FailStopResponse>(
      `/api/driver/routes/${routeId}/stops/${stopId}/fail`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
  },

  // Customer pickup verification & OTP resend helpers
  getPickupVerification: async (
    pickupId: string
  ): Promise<PickupVerificationResponse> => {
    return request<PickupVerificationResponse>(
      `/api/pickups/${pickupId}/verification`,
      {
        method: 'GET',
      }
    );
  },

  requestPickupOtp: async (
    pickupId: string
  ): Promise<RequestOTPResponse> => {
    return request<RequestOTPResponse>(
      `/api/pickups/${pickupId}/verification/request-otp`,
      {
        method: 'POST',
      }
    );
  },
};

