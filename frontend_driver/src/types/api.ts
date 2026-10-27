export interface AuthUser {
  id: number;
  auth_user_id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface DriverProfile {
  id: number;
  user_id: number;
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  license_number: string;
  license_expiry?: string | null;
  status: string;
  is_available: boolean;
  created_at?: string;
  rating?: number;
  clean_transfers_count?: number;
  division?: string;
  certification_level?: string;
  base_depot?: string;
  shift_started_at?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
}

export type RouteStopType = 'PICKUP' | 'WAREHOUSE';
export type RouteStopStatus = 'PENDING' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type RouteStatus = 'DRAFT' | 'OPTIMIZING' | 'READY' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface RouteStop {
  id: number;
  sequence_number: number;
  stop_type: RouteStopType;
  pickup_id?: string;
  pickup_code?: string;
  location_id?: number;
  location_name?: string;
  customer_name?: string;
  customer_phone?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  address: string;
  city?: string;
  state?: string;
  postal_code?: string;
  latitude: number;
  longitude: number;
  estimated_weight_kg?: number | null;
  collected_weight_kg?: number | null;
  arrival_time?: string | null;
  departure_time?: string | null;
  proof_uploaded: boolean;
  qr_verified: boolean;
  otp_verified: boolean;
  execution_status: RouteStopStatus;
  failure_reason?: string | null;
  notes?: string | null;
}

export interface DriverRoute {
  id: number;
  route_code: string;
  route_date: string;
  status: RouteStatus;
  vehicle_id?: number | null;
  vehicle_registration_number?: string | null;
  vehicle_capacity_kg?: number | null;
  vehicle_type?: string | null;
  warehouse_id: number;
  warehouse_name: string;
  warehouse_address: string;
  warehouse_city: string;
  warehouse_state: string;
  warehouse_latitude: number;
  warehouse_longitude: number;
  planned_distance_km?: number | null;
  planned_duration_seconds?: number | null;
  stops: RouteStop[];
}

export interface VerifyQRResponse {
  message: string;
  stop_id: number;
  status: RouteStopStatus;
  arrived_at?: string;
  otp_required: boolean;
  otp?: string | null;
}

export interface VerifyOTPResponse {
  message: string;
  stop_id: number;
  status: RouteStopStatus;
  otp_verified: boolean;
}

export interface DiscrepancyReport {
  category: 'WEIGHT_MISMATCH' | 'OTP_UNAVAILABLE' | 'SEAL_DAMAGED' | 'OTHER';
  notes: string;
  fail_stop?: boolean;
}
