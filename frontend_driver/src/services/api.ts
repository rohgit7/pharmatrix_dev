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

  // Android emulators reach the host through this reserved emulator address.
  if (Platform.OS === 'android' && !Device.isDevice) {
    if (envUrl && envUrl.includes('10.0.2.2')) {
      return envUrl;
    }
    return 'http://10.0.2.2:8000';
  }

  // A physical phone cannot reach its own localhost. Prefer an explicitly
  // configured reachable API, otherwise use the host advertised by Expo.
  if (Device.isDevice) {
    const isLoopback = /localhost|127\.0\.0\.1|10\.0\.2\.2/.test(envUrl || '');
    if (envUrl && !isLoopback) {
      return envUrl;
    }
    if (detectedIp) return `http://${detectedIp}:8001`;
    return envUrl || '';
  }

  // Web preview runs in the visitor's browser, so localhost would point at
  // their own machine rather than the Replit workspace.
  if (Platform.OS === 'web') {
    return envUrl || '';
  }

  // An iOS simulator shares the host's loopback interface.
  if (Platform.OS === 'ios') {
    return envUrl && !envUrl.includes('10.0.2.2')
      ? envUrl
      : 'http://localhost:8000';
  }

  return envUrl || 'http://localhost:8000';
}

export async function getEffectiveApiBaseUrl(): Promise<string> {
  const custom = await TokenStorage.getCustomApiBaseUrl();
  if (custom && custom.trim().length > 0) {
    return custom.trim().replace(/\/+$/, '');
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
  if (!baseUrl) {
    throw new ApiError(
      'Backend URL is not configured. Enter a reachable HTTPS API URL in the sign-in settings.',
      0
    );
  }
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new ApiError('Backend URL must be a valid HTTP or HTTPS URL.', 0);
  }
  if (!['http:', 'https:'].includes(parsedBaseUrl.protocol)) {
    throw new ApiError('Backend URL must use HTTP or HTTPS.', 0);
  }
  if (
    Device.isDevice &&
    /^(localhost|127\.0\.0\.1|10\.0\.2\.2)$/i.test(parsedBaseUrl.hostname)
  ) {
    throw new ApiError(
      'This device cannot reach a loopback backend URL. Use the backend host address on your network.',
      0
    );
  }
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

  const externalSignal = options.signal;
  const fetchOptions = { ...options };
  delete fetchOptions.signal;
  if (externalSignal?.aborted) {
    throw new ApiError('Request was cancelled.', 499);
  }
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, 20000); // 20s timeout

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

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
    if (error instanceof ApiError) {
      throw error;
    }

    const errMsg = String(error?.message || '');
    if (externalSignal?.aborted) {
      throw new ApiError('Request was cancelled.', 499);
    }
    const isTimeout =
      didTimeout ||
      (error?.name === 'AbortError' && !externalSignal?.aborted) ||
      errMsg.toLowerCase().includes('timeout');
    const isConnectionError =
      errMsg.toLowerCase().includes('network request failed') ||
      errMsg.toLowerCase().includes('failed to fetch') ||
      errMsg.toLowerCase().includes('networkerror') ||
      errMsg.toLowerCase().includes('connection refused') ||
      error?.name === 'TypeError';

    if (isTimeout || isConnectionError) {
      if (isTimeout) {
        throw new ApiError(
          `Request to ${baseUrl} timed out after 20 seconds. Check the backend and network connection, then retry.`,
          408
        );
      }

      throw new ApiError(
        `Cannot connect to the backend at ${baseUrl}. Check that the URL is reachable from this device and that the backend is running.`,
        0
      );
    }

    throw new ApiError(
      error.message || `Network connection failed. Ensure backend API is accessible at ${baseUrl}.`,
      0
    );
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export const ApiClient = {
  checkHealth: async (targetUrl?: string): Promise<{ ok: boolean; status?: number; workingUrl?: string; error?: string }> => {
    const base = targetUrl ? targetUrl.trim().replace(/\/+$/, '') : await getEffectiveApiBaseUrl();
    if (!base) {
      return {
        ok: false,
        error: 'Backend URL is not configured. Enter a reachable API URL first.',
      };
    }

    const testSingle = async (url: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(`${url}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        return { ok: res.ok, status: res.status, url };
      } catch (e: any) {
        return { ok: false, error: e.message || 'Connection failed', url };
      } finally {
        clearTimeout(timeoutId);
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

  getMe: async (signal?: AbortSignal): Promise<UserMeResponse> => {
    return request<UserMeResponse>('/api/auth/me', {
      method: 'GET',
      signal,
    });
  },

  getDriverMe: async (): Promise<DriverMeResponse> => {
    return request<DriverMeResponse>('/api/admin/drivers/me', {
      method: 'GET',
    });
  },

  // Driver route endpoints
  getTodayRoute: async (signal?: AbortSignal): Promise<DriverRouteResponse> => {
    return request<DriverRouteResponse>('/api/driver/routes/today', {
      method: 'GET',
      signal,
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
    const response = await request<VerifyQRResponse & { otp?: string | null }>(
      `/api/driver/routes/${routeId}/stops/${stopId}/scan-qr`,
      {
        method: 'POST',
        body: JSON.stringify({ qr_token: qrToken }),
      }
    );
    // Older development servers include the generated OTP in this response.
    // Never expose or autofill it in the driver UI.
    const { otp: _otp, ...safeResponse } = response;
    return safeResponse;
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
    const response = await request<RequestOTPResponse & { otp?: string }>(
      `/api/pickups/${pickupId}/verification/request-otp`,
      {
        method: 'POST',
      }
    );
    const { otp: _otp, ...safeResponse } = response;
    return safeResponse;
  },
};

