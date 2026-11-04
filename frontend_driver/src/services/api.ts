import { NativeModules, Platform } from 'react-native';
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

let cachedCustomUrl: string | null = null;

export const setCustomApiUrl = async (url: string | null): Promise<void> => {
  let clean = url ? url.trim().replace(/\/+$/, '') : null;
  if (clean && clean.includes(':8000') && !clean.includes('127.0.0.1') && !clean.includes('localhost')) {
    clean = clean.replace(':8000', ':8001');
  }
  cachedCustomUrl = clean;
  if (cachedCustomUrl) {
    await storage.setItem('custom_api_url', cachedCustomUrl);
  } else {
    await storage.removeItem('custom_api_url');
  }
};

export const getApiBaseUrl = (): string => {
  // 1. In-memory or locally configured custom override
  if (cachedCustomUrl) {
    if (cachedCustomUrl.includes(':8000') && !cachedCustomUrl.includes('127.0.0.1') && !cachedCustomUrl.includes('localhost')) {
      cachedCustomUrl = cachedCustomUrl.replace(':8000', ':8001');
      storage.setItem('custom_api_url', cachedCustomUrl).catch(() => {});
    }
    return cachedCustomUrl;
  }

  // 2. Environment variable if bundled
  if (process.env.EXPO_PUBLIC_API_URL) {
    let envUrl = process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
    if (envUrl.includes(':8000') && !envUrl.includes('127.0.0.1') && !envUrl.includes('localhost')) {
      envUrl = envUrl.replace(':8000', ':8001');
    }
    return envUrl;
  }

  // 3. Web browser environment
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:8001`;
  }

  // 4. Physical Mobile Device (Expo Go): Extract computer's LAN IP from Metro bundle URL
  const scriptUrl: string | undefined = NativeModules?.SourceCode?.scriptURL;
  if (scriptUrl) {
    const match = scriptUrl.match(/^https?:\/\/([^:/]+)/);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
      return `http://${match[1]}:8001`;
    }
  }

  // 5. Expo Constants (manifest / expoConfig host)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.expoGoConfig?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:8001`;
    }
  }

  // 6. Direct fallback to host computer's known Wi-Fi LAN IP on firewall-allowed port 8001
  return 'http://10.235.154.167:8001';
};

// Asynchronously load custom url from storage at app start
storage.getItem('custom_api_url').then((val) => {
  if (val) {
    let clean = val.trim().replace(/\/+$/, '');
    if (clean.includes(':8000') && !clean.includes('127.0.0.1') && !clean.includes('localhost')) {
      clean = clean.replace(':8000', ':8001');
      storage.setItem('custom_api_url', clean).catch(() => {});
    }
    cachedCustomUrl = clean;
  }
}).catch(() => {});

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

export const testApiConnection = async (targetUrl?: string): Promise<{ ok: boolean; message: string; url: string }> => {
  const base = (targetUrl || getApiBaseUrl()).replace(/\/+$/, '');

  const tryProbe = async (url: string): Promise<boolean> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  };

  // 1. Try specified or resolved base URL
  if (await tryProbe(base)) {
    return { ok: true, message: 'Backend reachable', url: base };
  }

  // 2. Auto-heal: If 8000 failed due to Windows Firewall, try 8001 (Node proxy)
  if (base.includes(':8000')) {
    const alt8001 = base.replace(':8000', ':8001');
    if (await tryProbe(alt8001)) {
      cachedCustomUrl = alt8001;
      await storage.setItem('custom_api_url', alt8001);
      return { ok: true, message: 'Connected via proxy (port 8001)', url: alt8001 };
    }
  }

  // 3. Auto-heal: If 8001 was tested and failed, try 8000
  if (base.includes(':8001')) {
    const alt8000 = base.replace(':8001', ':8000');
    if (await tryProbe(alt8000)) {
      cachedCustomUrl = alt8000;
      await storage.setItem('custom_api_url', alt8000);
      return { ok: true, message: 'Connected to backend (port 8000)', url: alt8000 };
    }
  }

  return {
    ok: false,
    message: `Cannot reach server at ${base}. Check Wi-Fi connection and backend status.`,
    url: base,
  };
};

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
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

  let baseUrl = getApiBaseUrl();
  let url = `${baseUrl}${endpoint}`;

  const executeFetch = async (targetUrl: string, timeout: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(targetUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  let response: Response;
  try {
    response = await executeFetch(url, timeoutMs);
  } catch (error: any) {
    // Auto-heal fallback: If connecting to port 8000 failed (firewall block), try port 8001
    if (url.includes(':8000')) {
      const healedBase = baseUrl.replace(':8000', ':8001');
      const healedUrl = `${healedBase}${endpoint}`;
      try {
        response = await executeFetch(healedUrl, timeoutMs);
        setCustomApiUrl(healedBase).catch(() => {});
      } catch {
        // Fall through
      }
    }

    if (!response!) {
      if (error.name === 'AbortError') {
        throw new ApiError(
          408,
          `Connection timed out connecting to ${baseUrl}. Check Wi-Fi connection and backend status.`
        );
      }
      if (error instanceof ApiError) {
        throw error;
      }
      const rawDetail = error?.message ? ` (${error.message})` : '';
      throw new ApiError(
        0,
        `Cannot connect to backend server at ${baseUrl}${rawDetail}. Ensure backend is running and phone is on the same Wi-Fi network.`
      );
    }
  }

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
    stopId: number,
    latitude?: number,
    longitude?: number,
    accuracyMeters?: number
  ): Promise<{ message: string; stop_id: number; status: string; arrived_at?: string }> {
    const body: Record<string, any> = {};
    if (latitude !== undefined && latitude !== null) body.latitude = latitude;
    if (longitude !== undefined && longitude !== null) body.longitude = longitude;
    if (accuracyMeters !== undefined && accuracyMeters !== null) body.accuracy_meters = accuracyMeters;

    return request(`/api/driver/routes/${routeId}/stops/${stopId}/arrive`, {
      method: 'POST',
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
  },

  async recordStopWeight(
    routeId: number,
    stopId: number,
    collectedWeightKg: number
  ): Promise<{ message: string; stop_id: number; status: string; collected_weight_kg: number }> {
    return request(
      `/api/driver/routes/${routeId}/stops/${stopId}/weigh`,
      {
        method: 'POST',
        body: JSON.stringify({ collected_weight_kg: collectedWeightKg }),
      }
    );
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
    // 1. Process string input (base64, data: URI, or native file/content URI)
    if (typeof fileInput === 'string') {
      let base64Payload = fileInput;

      // If it's a native file/content URI, convert it to Base64 using expo-file-system
      if (
        fileInput.startsWith('file://') ||
        fileInput.startsWith('content://') ||
        fileInput.startsWith('/') ||
        fileInput.startsWith('ph://')
      ) {
        try {
          // Dynamic require so bundler without native module does not crash
          const FileSystem = require('expo-file-system');
          if (FileSystem && FileSystem.readAsStringAsync) {
            const rawBase64 = await FileSystem.readAsStringAsync(fileInput, {
              encoding: FileSystem.EncodingType?.Base64 || 'base64',
            });
            if (rawBase64) {
              base64Payload = `data:${mimeType};base64,${rawBase64}`;
            }
          }
        } catch (fsErr) {
          console.warn('[uploadCollectionProof] FileSystem conversion error:', fsErr);
        }
      }

      // If we have a base64 payload or data: URI, send to dedicated base64 endpoint as JSON
      if (
        base64Payload.startsWith('data:') ||
        base64Payload.startsWith('/9j/') ||
        base64Payload.startsWith('iVBOR') ||
        !base64Payload.startsWith('file://')
      ) {
        const normalized = base64Payload.startsWith('data:')
          ? base64Payload
          : `data:${mimeType};base64,${base64Payload}`;

        return request(
          `/api/driver/routes/${routeId}/stops/${stopId}/proof-base64`,
          {
            method: 'POST',
            body: JSON.stringify({
              image_base64: normalized,
              file_name: fileName,
            }),
          },
          60000
        );
      }
    }

    // 2. Web Blob/File handling: convert to base64 via FileReader for consistent JSON transport
    if (typeof fileInput !== 'string' && typeof FileReader !== 'undefined') {
      try {
        const base64FromBlob = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileInput as Blob);
        });
        if (base64FromBlob) {
          return request(
            `/api/driver/routes/${routeId}/stops/${stopId}/proof-base64`,
            {
              method: 'POST',
              body: JSON.stringify({
                image_base64: base64FromBlob,
                file_name: fileName,
              }),
            },
            60000
          );
        }
      } catch (blobErr) {
        console.warn('[uploadCollectionProof] FileReader error:', blobErr);
      }
    }

    // 3. Fallback: Multipart Form-Data
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
      const uriStr = typeof fileInput === 'string' ? fileInput : (fileInput as any).uri;
      formData.append('file', {
        uri: uriStr,
        name: fileName,
        type: mimeType,
      } as any);
    }

    return request(
      `/api/driver/routes/${routeId}/stops/${stopId}/proof`,
      {
        method: 'POST',
        body: formData,
      },
      60000
    );
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
