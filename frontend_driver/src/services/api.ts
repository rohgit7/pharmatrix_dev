import { Platform } from 'react-native';
import Constants from 'expo-constants';
import storage from './storage';
import {
  AuthUser,
  DriverProfile,
  DriverRoute,
  LoginResponse,
  VerifyOTPResponse,
  VerifyQRResponse,
} from '../types/api';

export const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 1. Web browser: Use current hostname (matches localhost, 127.0.0.1, or local LAN IP)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:8000`;
  }

  // 2. Mobile device (Expo Go): Detect host IP address that Metro is served from
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:8000`;
    }
  }

  // 3. Fallback for Android Studio emulator
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<T> {
  const token = await storage.getItem('access_token');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const isFormData =
    typeof FormData !== 'undefined' &&
    (options.body instanceof FormData ||
      (options.body !== null &&
        typeof options.body === 'object' &&
        ('_parts' in (options.body as any) ||
          (options.body as any).constructor?.name === 'FormData')));

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      let errorMessage = 'Request failed';
      if (typeof data === 'object' && data !== null && data.detail) {
        errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      } else if (typeof data === 'string' && data.length > 0) {
        errorMessage = data;
      }

      throw new ApiError(response.status, errorMessage, data);
    }

    return data as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new ApiError(408, 'Connection timed out. Please check your network connection.');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      0,
      error?.message || 'Network error: could not connect to server'
    );
  }
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    if (res.access_token) {
      await storage.setItem('access_token', res.access_token);
      if (res.refresh_token) {
        await storage.setItem('refresh_token', res.refresh_token);
      }
    }
    return res;
  },

  async getMe(): Promise<AuthUser> {
    return request<AuthUser>('/api/auth/me');
  },

  // Driver Profile
  async getDriverProfile(): Promise<DriverProfile> {
    return request<DriverProfile>('/api/admin/drivers/me');
  },

  // Today's Route
  async getTodayRoute(): Promise<DriverRoute> {
    return request<DriverRoute>('/api/driver/routes/today');
  },

  // Route Execution
  async startRoute(routeId: number): Promise<{ message: string; route_id: number; status: string }> {
    return request(`/api/driver/routes/${routeId}/start`, {
      method: 'POST',
    });
  },

  async arriveAtStop(
    routeId: number,
    stopId: number
  ): Promise<{ message: string; stop_id: number; status: string; arrived_at?: string }> {
    return request(`/api/driver/routes/${routeId}/stops/${stopId}/arrive`, {
      method: 'POST',
    });
  },

  async scanQR(
    routeId: number,
    stopId: number,
    qrToken: string
  ): Promise<VerifyQRResponse> {
    return request<VerifyQRResponse>(
      `/api/driver/routes/${routeId}/stops/${stopId}/scan-qr`,
      {
        method: 'POST',
        body: JSON.stringify({ qr_token: qrToken }),
      }
    );
  },

  async verifyOTP(
    routeId: number,
    stopId: number,
    otp: string
  ): Promise<VerifyOTPResponse> {
    return request<VerifyOTPResponse>(
      `/api/driver/routes/${routeId}/stops/${stopId}/verify-otp`,
      {
        method: 'POST',
        body: JSON.stringify({ otp: otp.trim() }),
      }
    );
  },

  async requestResendOTP(pickupId: string): Promise<{ otp?: string; expires_at?: string; message: string }> {
    return request(`/api/pickups/${pickupId}/verification/request-otp`, {
      method: 'POST',
    });
  },

  async uploadCollectionProof(
    routeId: number,
    stopId: number,
    fileInput: string | Blob | File,
    fileName: string = 'collection_proof.jpg',
    mimeType: string = 'image/jpeg'
  ): Promise<{ message: string; stop_id: number; proof_uploaded: boolean; proof_uploaded_at?: string }> {
    const formData = new FormData();
    if (Platform.OS === 'web') {
      if (typeof fileInput === 'string') {
        const response = await fetch(fileInput);
        const blob = await response.blob();
        formData.append('file', blob, fileName);
      } else {
        formData.append('file', fileInput, fileName);
      }
    } else {
      formData.append('file', {
        uri: typeof fileInput === 'string' ? fileInput : (fileInput as any).uri,
        name: fileName,
        type: mimeType,
      } as any);
    }

    return request(`/api/driver/routes/${routeId}/stops/${stopId}/proof`, {
      method: 'POST',
      body: formData,
    });
  },

  async getCollectionProofUrl(
    routeId: number,
    stopId: number,
    expiresIn: number = 3600
  ): Promise<{
    stop_id: number;
    route_id: number;
    proof_uploaded: boolean;
    expires_in: number;
    signed_url: string;
  }> {
    return request(`/api/driver/routes/${routeId}/stops/${stopId}/proof-url?expires_in=${expiresIn}`);
  },

  async completeStop(
    routeId: number,
    stopId: number,
    collectedWeightKg: number = 0,
    notes?: string
  ): Promise<{ message: string; stop_id: number; status: string; completed_at?: string }> {
    const payload: { collected_weight_kg: number; notes?: string } = {
      collected_weight_kg: Math.max(0, Number(collectedWeightKg) || 0),
    };
    if (notes) {
      payload.notes = notes;
    }
    return request(`/api/driver/routes/${routeId}/stops/${stopId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async failStop(
    routeId: number,
    stopId: number,
    reason: string
  ): Promise<{ message: string; stop_id: number; status: string; reason: string }> {
    return request(`/api/driver/routes/${routeId}/stops/${stopId}/fail`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async reportDiscrepancy(
    routeId: number,
    stopId: number,
    category: string,
    notes: string,
    failStop: boolean = false
  ): Promise<any> {
    if (failStop) {
      return this.failStop(routeId, stopId, `[${category}] ${notes}`);
    }
    return this.failStop(routeId, stopId, `[${category}] ${notes}`);
  },
};

export default api;
