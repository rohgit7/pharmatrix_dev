import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { storage } from './storage';

let cachedCustomUrl: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorizedCallback = handler;
};

export const setCustomApiBaseUrl = async (url: string | null) => {
  if (url && url.trim().length > 0) {
    let clean = url.trim().replace(/\/+$/, '');
    if (clean.includes(':8000') && !clean.includes('127.0.0.1') && !clean.includes('localhost')) {
      clean = clean.replace(':8000', ':8001');
    }
    cachedCustomUrl = clean;
    await storage.setItem('custom_api_url', clean);
  } else {
    cachedCustomUrl = null;
    await storage.removeItem('custom_api_url');
  }
};

export const getCustomApiBaseUrl = () => cachedCustomUrl;

export const getApiBaseUrl = (): string => {
  if (cachedCustomUrl) {
    if (
      cachedCustomUrl.includes(':8000') &&
      !cachedCustomUrl.includes('127.0.0.1') &&
      !cachedCustomUrl.includes('localhost')
    ) {
      cachedCustomUrl = cachedCustomUrl.replace(':8000', ':8001');
      storage.setItem('custom_api_url', cachedCustomUrl).catch(() => {});
    }
    return cachedCustomUrl;
  }

  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    let cleanEnv = envUrl.trim().replace(/\/+$/, '');
    if (Platform.OS === 'web') {
      return cleanEnv;
    }
    if (!cleanEnv.includes('localhost') && !cleanEnv.includes('127.0.0.1')) {
      if (cleanEnv.includes(':8000')) {
        cleanEnv = cleanEnv.replace(':8000', ':8001');
      }
      return cleanEnv;
    }
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || 'localhost';
    const port = hostname === 'localhost' || hostname === '127.0.0.1' ? 8000 : 8001;
    return `http://${hostname}:${port}`;
  }

  const scriptUrl: string | undefined = NativeModules?.SourceCode?.scriptURL;
  if (scriptUrl) {
    const match = scriptUrl.match(/^https?:\/\/([^:/]+)/);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1' && !match[1].includes('exp.direct')) {
      return `http://${match[1]}:8001`;
    }
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.expoGoConfig?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.includes('exp.direct')) {
      return `http://${host}:8001`;
    }
  }

  return 'http://10.235.154.167:8001';
};

storage
  .getItem('custom_api_url')
  .then((val) => {
    if (val) {
      let clean = val.trim().replace(/\/+$/, '');
      if (clean.includes(':8000') && !clean.includes('127.0.0.1') && !clean.includes('localhost')) {
        clean = clean.replace(':8000', ':8001');
        storage.setItem('custom_api_url', clean).catch(() => {});
      }
      cachedCustomUrl = clean;
    }
  })
  .catch(() => {});

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

export const testApiConnection = async (
  targetUrl?: string
): Promise<{ ok: boolean; message: string; url: string }> => {
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

  if (await tryProbe(base)) {
    return { ok: true, message: 'Connected to Pharmatrix Backend', url: base };
  }

  if (base.includes(':8000')) {
    const alt8001 = base.replace(':8000', ':8001');
    if (await tryProbe(alt8001)) {
      cachedCustomUrl = alt8001;
      await storage.setItem('custom_api_url', alt8001);
      return { ok: true, message: 'Connected via proxy (port 8001)', url: alt8001 };
    }
  }

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
    message: `Cannot reach server at ${base}. Verify backend is running on port 8000.`,
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

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

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

  try {
    let response: Response;
    try {
      response = await executeFetch(url, timeoutMs);
    } catch (firstErr: any) {
      if (baseUrl.includes(':8000')) {
        const altBase = baseUrl.replace(':8000', ':8001');
        response = await executeFetch(`${altBase}${endpoint}`, 6000);
        cachedCustomUrl = altBase;
        storage.setItem('custom_api_url', altBase).catch(() => {});
      } else if (baseUrl.includes(':8001')) {
        const altBase = baseUrl.replace(':8001', ':8000');
        response = await executeFetch(`${altBase}${endpoint}`, 6000);
        cachedCustomUrl = altBase;
        storage.setItem('custom_api_url', altBase).catch(() => {});
      } else {
        throw firstErr;
      }
    }

    let data: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { detail: text } : null;
    }

    if (!response.ok) {
      if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
        onUnauthorizedCallback?.();
      }
      const errorMessage =
        typeof data?.detail === 'string'
          ? data.detail
          : Array.isArray(data?.detail)
          ? data.detail.map((e: any) => `${e.loc?.slice(-1)?.[0] || 'Field'}: ${e.msg}`).join(', ')
          : data?.message || `Request failed with status ${response.status}`;

      throw new ApiError(response.status, errorMessage, data);
    }

    return data as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error?.name === 'AbortError') {
      throw new ApiError(
        408,
        `Connection timed out (${baseUrl}). Ensure the Pharmatrix backend is running.`
      );
    }
    throw new ApiError(
      0,
      `Cannot reach server at ${baseUrl}. Ensure the Pharmatrix backend is running.`
    );
  }
}

// ============================================================================
// Typed Interfaces matching Pharmatrix Backend Schemas
// ============================================================================

export type CustomerType = 'PHARMACY' | 'DISTRIBUTOR' | 'HOSPITAL' | 'CLINIC';
export type PickupStatus =
  | 'REQUESTED'
  | 'SCHEDULED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COLLECTED'
  | 'FAILED'
  | 'CANCELLED';
export type PickupPriority = 'NORMAL' | 'HIGH' | 'URGENT';
export type PaymentStatus = 'PAID' | 'PENDING' | 'PARTIALLY_PAID' | 'AWAITING_WEIGHING';

export interface AuthUser {
  id: number;
  auth_user_id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface CustomerLocation {
  id: number;
  public_id?: string;
  location_code: string;
  name: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  contact_name: string;
  contact_phone: string;
  service_time_seconds?: number;
  is_active: boolean;
}

export interface CustomerProfileData {
  // Pharmacy
  pharmacy_license_number?: string | null;
  pharmacist_name?: string | null;
  license_verified?: boolean;
  // Distributor
  distribution_license_number?: string | null;
  warehouse_count?: number | null;
  coverage_area?: string | null;
  // Hospital
  registration_number?: string | null;
  hospital_type?: string | null;
  department_count?: number | null;
  registration_verified?: boolean;
  // Clinic
  clinic_type?: string | null;
  doctor_name?: string | null;
  speciality?: string | null;
}

export interface CustomerMeResponse {
  onboarded: boolean;
  id?: number;
  public_id?: string;
  customer_code?: string;
  customer_type?: CustomerType;
  legal_name?: string;
  display_name?: string;
  phone?: string;
  email?: string | null;
  gst_number?: string | null;
  is_active?: boolean;
  locations?: CustomerLocation[];
  profile?: CustomerProfileData | null;
}

export interface CustomerOnboardPayload {
  customer_type: CustomerType;
  legal_name: string;
  display_name: string;
  phone: string;
  email?: string;
  gst_number?: string;
  profile?: CustomerProfileData;
  location: {
    location_code: string;
    name: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    latitude: number;
    longitude: number;
    contact_name: string;
    contact_phone: string;
    service_time_seconds?: number;
  };
}

export interface WasteCategoryItem {
  code: string;
  name: string;
  bin_color: 'YELLOW' | 'RED' | 'WHITE' | 'BLUE';
  description: string;
}

export interface TimeSlotItem {
  id: string;
  label: string;
  window: string;
}

export interface WasteCategoriesMetadata {
  waste_categories: WasteCategoryItem[];
  time_slots: TimeSlotItem[];
  priorities: { code: PickupPriority; label: string }[];
  max_pickup_weight_kg: number;
}

export interface PickupSummaryItem {
  id: number;
  public_id: string;
  pickup_code: string;
  customer_id: number;
  location_id: number;
  location_name: string;
  location_address: string;
  status: PickupStatus;
  priority: PickupPriority;
  requested_date?: string | null;
  scheduled_date?: string | null;
  collected_at?: string | null;
  created_at: string;
  updated_at: string;
  estimated_weight_kg?: number | null;
  actual_weight_kg?: number | null;
  waste_categories: string[];
  time_slot: string;
  remarks: string;
  notes?: string | null;
  payment_status: PaymentStatus;
  total_amount?: number | null;
  amount_due?: number | null;
  currency: string;
  handover_confirmed: boolean;
  qr_verified: boolean;
  otp_verified: boolean;
  driver_name?: string | null;
}

export interface DashboardData {
  total_pickups: number;
  active_pickups: number;
  upcoming_pickups: number;
  completed_pickups: number;
  pending_payments: number;
  pending_payment_amount: number;
  recent_pickups: PickupSummaryItem[];
}

export interface InvoiceLineItemData {
  id: number;
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface PaymentItemData {
  id: number;
  public_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_reference?: string | null;
  status: string;
  paid_at?: string | null;
}

export interface InvoiceData {
  id: number;
  public_id: string;
  invoice_number: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: string;
  issued_at: string;
  due_date?: string | null;
  paid_at?: string | null;
  pricing_snapshot: Record<string, any>;
  line_items: InvoiceLineItemData[];
  payments: PaymentItemData[];
}

export interface PickupTimelineStep {
  key: string;
  title: string;
  description: string;
  completed: boolean;
  timestamp?: string | null;
}

export interface PickupDetailsData {
  id: number;
  public_id: string;
  pickup_code: string;
  verification_token: string;
  status: PickupStatus;
  priority: PickupPriority;
  requested_date?: string | null;
  scheduled_date?: string | null;
  collected_at?: string | null;
  created_at: string;
  updated_at: string;
  failure_reason?: string | null;
  notes?: string | null;
  remarks: string;
  time_slot: string;
  waste_categories: string[];
  waste_breakdown: {
    code: string;
    name: string;
    bin_color: string;
    description: string;
    estimated_weight_kg?: number | null;
    actual_weight_kg?: number | null;
  }[];
  estimated_weight_kg?: number | null;
  actual_weight_kg?: number | null;
  weight_discrepancy_kg?: number | null;
  weight_discrepancy_pct?: number | null;
  handover_confirmed: boolean;
  handover_confirmed_at?: string | null;
  handover_notes?: string | null;
  location?: CustomerLocation | null;
  driver?: {
    driver_id?: number | null;
    name: string;
    phone?: string | null;
    license_number?: string | null;
    vehicle_number?: string | null;
    vehicle_type?: string | null;
    route_id: number;
    route_code: string;
    route_status: string;
    stop_id: number;
    stop_status: string;
    arrived_at?: string | null;
    completed_at?: string | null;
  } | null;
  payment_status: PaymentStatus;
  invoice?: InvoiceData | null;
  otp_status: {
    qr_verified: boolean;
    qr_verified_at?: string | null;
    otp_generated: boolean;
    otp_active: boolean;
    otp_verified: boolean;
    otp_verified_at?: string | null;
    otp_expires_at?: string | null;
    otp_attempts: number;
    max_attempts: number;
    cooldown_remaining_seconds: number;
  };
  timeline: PickupTimelineStep[];
}

export interface RazorpayOrderResponse {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_id: number;
  invoice_number: string;
  pickup_id: string;
  pickup_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
}

export interface RequestOTPResponse {
  pickup_id: string;
  otp: string;
  expires_at: string;
  message: string;
}

// ============================================================================
// Centralized API Service
// ============================================================================

export const api = {
  // Authentication
  async login(
    email: string,
    password: string
  ): Promise<{ access_token: string; refresh_token: string; user_id: string }> {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });
  },

  async registerCustomer(
    name: string,
    email: string,
    password: string
  ): Promise<{
    id: number;
    auth_user_id: string;
    name: string;
    email: string;
    role: string;
    access_token?: string | null;
    refresh_token?: string | null;
  }> {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
    });
  },

  async getMe(): Promise<AuthUser> {
    return request<AuthUser>('/api/auth/me');
  },

  // Customer Profile & Locations
  async getCustomerMe(): Promise<CustomerMeResponse> {
    return request<CustomerMeResponse>('/api/customers/me');
  },

  async onboardCustomer(payload: CustomerOnboardPayload): Promise<CustomerMeResponse> {
    return request<CustomerMeResponse>('/api/customers/onboard', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateCustomerMe(payload: {
    legal_name?: string;
    display_name?: string;
    phone?: string;
    email?: string;
    gst_number?: string;
    profile?: CustomerProfileData;
  }): Promise<CustomerMeResponse> {
    return request<CustomerMeResponse>('/api/customers/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async getLocations(): Promise<CustomerLocation[]> {
    return request<CustomerLocation[]>('/api/customers/locations');
  },

  async addLocation(payload: {
    location_code: string;
    name: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    latitude: number;
    longitude: number;
    contact_name: string;
    contact_phone: string;
    service_time_seconds?: number;
  }): Promise<CustomerLocation> {
    return request<CustomerLocation>('/api/customers/locations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Pickup Metadata & Dashboard
  async getWasteCategories(): Promise<WasteCategoriesMetadata> {
    return request<WasteCategoriesMetadata>('/api/pickups/waste-categories');
  },

  async getDashboard(): Promise<DashboardData> {
    return request<DashboardData>('/api/pickups/dashboard');
  },

  async getPickupHistory(params?: {
    status?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  }): Promise<{
    items: PickupSummaryItem[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.date_from) query.append('date_from', params.date_from);
    if (params?.date_to) query.append('date_to', params.date_to);
    if (params?.page) query.append('page', String(params.page));
    if (params?.page_size) query.append('page_size', String(params.page_size));
    const qs = query.toString();
    return request(`/api/pickups/history${qs ? `?${qs}` : ''}`);
  },

  // Create & Manage Pickups
  async createPickup(payload: {
    location_id: number;
    requested_date: string;
    priority: PickupPriority;
    estimated_weight_kg: number;
    waste_categories: string[];
    time_slot: string;
    notes?: string;
  }): Promise<{
    id: number;
    public_id: string;
    pickup_code: string;
    status: PickupStatus;
    priority: PickupPriority;
    requested_date: string;
    estimated_weight_kg: number;
  }> {
    return request('/api/pickups/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getPickupDetails(pickupPublicId: string): Promise<PickupDetailsData> {
    return request<PickupDetailsData>(`/api/pickups/${pickupPublicId}/details`);
  },

  async confirmHandover(
    pickupPublicId: string,
    notes?: string
  ): Promise<{
    message: string;
    pickup_id: string;
    pickup_code: string;
    estimated_weight_kg?: number;
    actual_weight_kg: number;
    handover_confirmed: boolean;
    handover_confirmed_at: string;
    invoice: InvoiceData;
  }> {
    return request(`/api/pickups/${pickupPublicId}/handover/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmed: true, notes: notes || undefined }),
    });
  },

  async getPickupInvoice(pickupPublicId: string): Promise<InvoiceData> {
    return request<InvoiceData>(`/api/pickups/${pickupPublicId}/invoice`);
  },

  async createPaymentOrder(pickupPublicId: string): Promise<RazorpayOrderResponse> {
    return request<RazorpayOrderResponse>(`/api/pickups/${pickupPublicId}/payment/order`, {
      method: 'POST',
    });
  },

  async verifyPayment(
    pickupPublicId: string,
    payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }
  ): Promise<{
    status: string;
    message: string;
    payment_id: number;
    pickup_id: string;
    pickup_code: string;
    invoice: InvoiceData;
  }> {
    return request(`/api/pickups/${pickupPublicId}/payment/verify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async cancelPickup(
    pickupPublicId: string,
    reason: string
  ): Promise<{ id: number; public_id: string; status: PickupStatus }> {
    return request(`/api/pickups/${pickupPublicId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // OTP Verification
  async requestPickupOTP(pickupPublicId: string): Promise<RequestOTPResponse> {
    return request<RequestOTPResponse>(`/api/pickups/${pickupPublicId}/verification/request-otp`, {
      method: 'POST',
    });
  },

  async getPickupVerification(pickupPublicId: string): Promise<{
    pickup_id: string;
    pickup_code: string;
    verification_token: string;
    qr_verified: boolean;
    qr_verified_at?: string | null;
    otp_verified: boolean;
    otp_verified_at?: string | null;
    otp_expires_at?: string | null;
  }> {
    return request(`/api/pickups/${pickupPublicId}/verification`);
  },

  // Disposal & Compliance
  async getDisposalSummary(): Promise<{
    total_collected_pickups: number;
    disposed_pickups: number;
    in_disposal_pipeline_pickups: number;
    certificates_available: number;
  }> {
    return request('/api/customer/disposal/summary');
  },
};

