import { Platform } from 'react-native';
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
} from '@/types/api';

// Resolve default Base URL
export function getDefaultApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  // Standard fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
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
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

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
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out after 20 seconds. Please check your network connection.', 408);
    }
    throw new ApiError(
      error.message || 'Network connection failed. Ensure backend API is accessible.',
      0
    );
  }
}

export const ApiClient = {
  // Auth endpoints
  login: async (email: string, password: string): Promise<LoginResponse> => {
    return request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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
};
