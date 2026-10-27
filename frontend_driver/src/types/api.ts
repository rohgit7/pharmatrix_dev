// Strict TypeScript definitions corresponding to backend models and schemas

export type UserRole = 'ADMIN' | 'DRIVER' | 'CUSTOMER' | 'FACILITY';

export type DriverStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type RouteStatus =
  | 'DRAFT'
  | 'OPTIMIZING'
  | 'READY'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type RouteStopType = 'PICKUP' | 'WAREHOUSE';

export type RouteStopStatus =
  | 'PENDING'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED';

export type PickupStatus =
  | 'REQUESTED'
  | 'SCHEDULED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COLLECTED'
  | 'FAILED'
  | 'CANCELLED';

export type PickupPriority = 'NORMAL' | 'HIGH' | 'URGENT';

export type WarehouseIntakeStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'DISCREPANCY'
  | 'REJECTED';

export type WasteBinColor = 'YELLOW' | 'RED' | 'WHITE' | 'BLUE' | 'BROWN';

export type WasteType =
  | 'HUMAN_ANATOMICAL'
  | 'ANIMAL_ANATOMICAL'
  | 'SOILED'
  | 'EXPIRED_DISCARDED_MEDICINE'
  | 'CHEMICAL'
  | 'CHEMICAL_LIQUID'
  | 'CONTAMINATED_RECYCLABLE'
  | 'SHARPS'
  | 'GLASSWARE'
  | 'METALLIC_IMPLANT'
  | 'HAZARDOUS_OTHER';

// Authentication responses
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
}

export interface UserMeResponse {
  id: number;
  auth_user_id: string;
  name: string;
  email: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface DriverMeResponse {
  id: number;
  user_id: number;
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  license_number: string;
  license_expiry: string | null;
  status: DriverStatus;
  is_available: boolean;
  created_at: string;
}

// Driver Route Models
export interface DriverRouteStopResponse {
  id: number | null;
  sequence_number: number;
  stop_type: RouteStopType;

  pickup_id?: string | null;
  pickup_code?: string | null;

  location_id?: number | null;
  location_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  estimated_weight_kg?: number | null;
  collected_weight_kg?: number | null;

  warehouse_id?: number | null;
  warehouse_name?: string | null;

  arrival_time?: string | null;
  departure_time?: string | null;
  proof_uploaded: boolean;
  qr_verified?: boolean;
  otp_verified?: boolean;
  execution_status: RouteStopStatus;
  failure_reason?: string | null;
}

export interface DriverRouteResponse {
  id: number;
  route_code: string;
  route_date: string;
  status: RouteStatus;

  vehicle_id?: number | null;
  vehicle_registration_number?: string | null;

  warehouse_id: number;
  warehouse_name: string;
  warehouse_address: string;
  warehouse_city: string;
  warehouse_state: string;
  warehouse_latitude: number;
  warehouse_longitude: number;

  planned_distance_km?: number | null;
  planned_duration_seconds?: number | null;

  stops: DriverRouteStopResponse[];
}

// Execution Payloads & Responses
export interface StartRouteResponse {
  message: string;
  route_id: number;
  status: RouteStatus;
}

export interface ArriveStopResponse {
  message: string;
  stop_id: number;
  status: RouteStopStatus;
  arrived_at: string;
}

export interface VerifyQRRequest {
  qr_token: string;
}

export interface VerifyQRResponse {
  message: string;
  stop_id: number;
  status: RouteStopStatus;
  arrived_at?: string;
  otp_required: boolean;
}

export interface VerifyOTPRequest {
  otp: string;
}

export interface VerifyOTPResponse {
  message: string;
  stop_id: number;
  status: RouteStopStatus;
  otp_verified: boolean;
}

export interface CompletePickupRequest {
  collected_weight_kg: number;
  notes?: string | null;
}

export interface CompleteStopResponse {
  message: string;
  stop_id: number;
  status: RouteStopStatus;
  completed_at: string;
}

export interface FailStopRequest {
  reason: string;
}

export interface FailStopResponse {
  message: string;
  stop_id: number;
  status: RouteStopStatus;
  reason: string;
}

export interface ProofUploadResponse {
  message: string;
  stop_id: number;
  proof_uploaded: boolean;
  proof_uploaded_at: string;
}

export interface ProofUrlResponse {
  stop_id: number;
  route_id: number;
  proof_uploaded: boolean;
  expires_in: number;
  signed_url: string;
}

export interface ApiErrorDetail {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
}

export interface ApiErrorResponse {
  detail: string | ApiErrorDetail[];
}

export interface RequestOTPResponse {
  pickup_id: string;
  expires_at: string;
  message: string;
}

export interface PickupVerificationResponse {
  pickup_id: string;
  pickup_code: string;
  verification_token: string;
  qr_verified: boolean;
  qr_verified_at: string | null;
  otp_verified: boolean;
  otp_verified_at: string | null;
  otp_expires_at: string | null;
}

