export interface DriverPerformanceSummary {
  completed_this_week: number;
  completed_this_month: number;
  collected_weight_this_month_kg: number;
  completion_rate_percentage: number;
  avg_collection_duration_minutes: number | null;
  total_distance_km: number;
}

export interface DriverWorkSummaryResponse {
  total_pickups: number;
  completed_pickups: number;
  cancelled_pickups: number;
  failed_pickups: number;
  in_progress_pickups: number;
  total_collected_weight_kg: number;
  total_working_days: number;
  avg_pickups_per_day: number;
  performance: DriverPerformanceSummary;
}

export interface DriverPickupHistoryItem {
  id: number;
  public_id: string;
  pickup_code: string;
  status: string;
  priority: string;
  customer_id: number;
  customer_name: string;
  customer_type: string;
  location_id: number;
  location_name: string;
  address: string;
  city?: string | null;
  postal_code?: string | null;
  route_id?: number | null;
  route_code?: string | null;
  route_date?: string | null;
  requested_date?: string | null;
  scheduled_date?: string | null;
  completed_at?: string | null;
  estimated_weight_kg?: number | null;
  collected_weight_kg?: number | null;
  has_proof: boolean;
  qr_verified: boolean;
  otp_verified: boolean;
  failure_reason?: string | null;
  created_at: string;
}

export interface DriverPickupHistoryListResponse {
  items: DriverPickupHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TimelineEvent {
  stage: string;
  label: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'in_progress' | 'failed' | 'pending';
}

export interface OperationalExceptionItem {
  id: number;
  exception_type: string;
  status: string;
  created_at: string;
}

export interface DriverPickupDetailResponse {
  id: number;
  public_id: string;
  pickup_code: string;
  status: string;
  priority: string;
  customer_id: number;
  customer_name: string;
  customer_type: string;
  location_id: number;
  location_name: string;
  address: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state?: string | null;
  postal_code: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  route_id?: number | null;
  route_code?: string | null;
  route_date?: string | null;
  route_status?: string | null;
  vehicle_registration_number?: string | null;
  warehouse_name?: string | null;
  requested_date?: string | null;
  scheduled_date?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  estimated_weight_kg?: number | null;
  collected_weight_kg?: number | null;
  weight_discrepancy_kg?: number | null;
  notes?: string | null;
  failure_reason?: string | null;
  qr_verified: boolean;
  qr_verified_at?: string | null;
  otp_verified: boolean;
  otp_verified_at?: string | null;
  has_proof: boolean;
  proof_uploaded_at?: string | null;
  proof_storage_path?: string | null;
  proof_signed_url?: string | null;
  exceptions: OperationalExceptionItem[];
  timeline: TimelineEvent[];
  created_at: string;
  updated_at: string;
}

export interface DriverHistoryFilterParams {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
  sort_by?: 'recent' | 'oldest';
  start_date?: string;
  end_date?: string;
}

