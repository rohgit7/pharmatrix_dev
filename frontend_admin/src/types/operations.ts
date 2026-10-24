// ==========================================
// User & Enums
// ==========================================
export type UserRole = 'ADMIN' | 'DRIVER' | 'CUSTOMER' | 'FACILITY';

export type CustomerType = 'PHARMACY' | 'DISTRIBUTOR' | 'HOSPITAL' | 'CLINIC';

export type DriverStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type VehicleStatus = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'INACTIVE';

export type VehicleType = 'BIKE' | 'THREE_WHEELER' | 'VAN' | 'TRUCK';

export type PickupStatus = 
  | 'REQUESTED' 
  | 'SCHEDULED' 
  | 'ASSIGNED' 
  | 'IN_PROGRESS' 
  | 'COLLECTED' 
  | 'FAILED' 
  | 'CANCELLED';

export type PickupPriority = 'NORMAL' | 'HIGH' | 'URGENT';

export type RouteStatus = 
  | 'DRAFT' 
  | 'OPTIMIZING' 
  | 'READY' 
  | 'ASSIGNED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'CANCELLED';

export type RouteStopType = 'PICKUP' | 'WAREHOUSE';

export type RouteStopStatus = 'PENDING' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type WarehouseIntakeStatus = 'PENDING' | 'RECEIVED' | 'DISCREPANCY' | 'REJECTED';

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

export type DisposalShipmentStatus = 
  | 'CREATED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'DISCREPANCY'
  | 'CANCELLED'
  | 'DISPOSED';

export type NotificationChannel = 'IN_APP' | 'WHATSAPP' | 'EMAIL';

export type NotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

export type NotificationType = 
  | 'PICKUP_REQUESTED'
  | 'PICKUP_SCHEDULED'
  | 'PICKUP_REMINDER'
  | 'DRIVER_ASSIGNED'
  | 'PICKUP_COMPLETED'
  | 'SHIPMENT_DISPATCHED'
  | 'SHIPMENT_RECEIVED'
  | 'DISPOSAL_COMPLETED'
  | 'EXCEPTION_ESCALATED';

export type OperationalExceptionType = 
  | 'PICKUP_FAILED' 
  | 'WAREHOUSE_INTAKE_DISCREPANCY' 
  | 'DISPOSAL_SHIPMENT_DISCREPANCY';

export type OperationalExceptionStatus = 'OPEN' | 'ESCALATED' | 'RESOLVED';

export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
export type CustomerDocumentType =
  | 'AADHAAR'
  | 'DRUG_LICENSE'
  | 'BUSINESS_REGISTRATION'
  | 'GST_CERTIFICATE'
  | 'OTHER';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DecimalString = string;

// ==========================================
// Pickups
// ==========================================
export interface PickupAdminResponse {
  id: number;
  public_id: string;
  pickup_code: string;
  customer_id: number;
  location_id: number;
  status: PickupStatus;
  priority: PickupPriority;
  requested_date: string | null;
  scheduled_date: string | null;
  notes: string | null;
  failure_reason: string | null;
  collected_at: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  estimated_weight_kg?: number | null;
  operational_state?: 'awaiting_selection' | 'selected' | 'optimized' | 'awaiting_assignment' | 'awaiting_dispatch' | 'dispatched' | 'completed' | 'cancelled' | 'failed' | 'requested' | 'scheduled_other_date' | string;
  route_id?: number | null;
  route_code?: string | null;
  route_status?: string | null;
  is_eligible_for_tomorrow?: boolean;
  ineligibility_reason?: string | null;
}

export interface PickupAdminCreate {
  customer_id: number;
  location_id: number;
  priority?: PickupPriority;
  notes?: string | null;
  scheduled_date?: string | null;
}

export interface PickupAdminUpdate {
  status?: PickupStatus;
  priority?: PickupPriority;
  scheduled_date?: string | null;
  notes?: string | null;
  failure_reason?: string | null;
}

export interface PickupScheduleRequest {
  scheduled_date: string;
}

export interface PickupCancelRequest {
  reason: string;
}

// ==========================================
// Customers & Locations
// ==========================================
export interface CustomerLocationResponse {
  id: number;
  customer_id: number;
  name: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  contact_name: string | null;
  contact_phone: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerLocationCreate {
  name: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  contact_name?: string | null;
  contact_phone?: string | null;
  is_primary?: boolean;
}

export interface CustomerLocationUpdate {
  name?: string;
  address_line_1?: string;
  address_line_2?: string | null;
  city?: string;
  state?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  contact_name?: string | null;
  contact_phone?: string | null;
  is_primary?: boolean;
  is_active?: boolean;
}

export interface CustomerResponse {
  id: number;
  public_id: string;
  customer_type: CustomerType;
  legal_name: string;
  display_name: string;
  phone: string;
  email: string;
  gst_number: string | null;
  pan_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PharmacyProfile {
  id: number;
  customer_id: number;
  pharmacy_license_number: string | null;
  pharmacist_name: string | null;
  license_verified: boolean;
}

export interface DistributorProfile {
  id: number;
  customer_id: number;
  distribution_license_number: string | null;
  warehouse_count: number;
  coverage_area: string | null;
  license_verified: boolean;
}

export interface HospitalProfile {
  id: number;
  customer_id: number;
  registration_number: string | null;
  hospital_type: string | null;
  department_count: number | null;
  registration_verified: boolean;
}

export interface ClinicProfile {
  id: number;
  customer_id: number;
  registration_number: string | null;
  clinic_type: string | null;
  doctor_name: string | null;
  speciality: string | null;
  registration_verified: boolean;
}

export interface CustomerDetailResponse extends CustomerResponse {
  locations: CustomerLocationResponse[];
  pharmacy_profile?: PharmacyProfile | null;
  distributor_profile?: DistributorProfile | null;
  hospital_profile?: HospitalProfile | null;
  clinic_profile?: ClinicProfile | null;
}

export interface CustomerCreate {
  customer_type: CustomerType;
  legal_name: string;
  display_name: string;
  phone: string;
  email: string;
  gst_number?: string | null;
  pan_number?: string | null;
  is_active?: boolean;
  location?: CustomerLocationCreate | null;
  profile?: Record<string, any> | null;
}

export interface CustomerUpdate {
  customer_type?: CustomerType;
  legal_name?: string;
  display_name?: string;
  phone?: string;
  email?: string;
  gst_number?: string | null;
  pan_number?: string | null;
  is_active?: boolean;
}

// ==========================================
// Users Management
// ==========================================
export interface UserResponse {
  id: number;
  auth_user_id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  name: string;
  email: string;
  password?: string | null;
  role: UserRole;
  is_active?: boolean;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  role?: UserRole;
  is_active?: boolean;
  password?: string;
}

// ==========================================
// Pricing Plans & Assignments
// ==========================================
export interface PricingPlanVersionResponse {
  id: number;
  pricing_plan_id: number;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  currency: string;
  per_kg_rate: DecimalString;
  pickup_fee: DecimalString;
  subscription_fee: DecimalString;
  minimum_pickup_charge: DecimalString;
  included_weight_kg: DecimalString;
  effective_from: string;
  effective_until: string | null;
  fee_rules: Record<string, JsonValue>;
  created_at: string;
}

export interface PricingPlanVersionCreate {
  version: number;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  currency?: string;
  per_kg_rate: number;
  pickup_fee: number;
  subscription_fee: number;
  minimum_pickup_charge: number;
  included_weight_kg: number;
  effective_from?: string | null;
  effective_until?: string | null;
  fee_rules?: Record<string, JsonValue>;
}

export interface PricingPlanResponse {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  versions?: PricingPlanVersionResponse[];
}

export interface PricingPlanCreate {
  code: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface PricingPlanUpdate {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

export interface CustomerPricingAssignmentResponse {
  id: number;
  customer_id: number;
  customer_public_id: string;
  customer_name: string;
  pricing_plan_id: number;
  pricing_plan_code: string;
  pricing_plan_name: string;
  effective_from: string;
  effective_until: string | null;
  reason: string | null;
  created_at: string;
}

export interface CustomerPricingAssignmentCreate {
  customer_id: number;
  pricing_plan_id: number;
  effective_from?: string | null;
  effective_until?: string | null;
  reason?: string | null;
}

// ==========================================
// Disposal Certificates
// ==========================================
export interface DisposalCertificateResponse {
  id: number;
  certificate_number: string;
  shipment_id: number;
  facility_id: number;
  facility_name?: string | null;
  storage_key: string;
  sha256_hash: string;
  issued_at: string;
  created_at: string;
}

export interface DisposalCertificateCreate {
  certificate_number: string;
  shipment_id: number;
  facility_id: number;
  storage_key: string;
  sha256_hash: string;
  issued_at?: string;
}

// ==========================================
// Routes & Stops
// ==========================================
export interface RouteStopResponse {
  id: number;
  sequence_number: number;
  stop_type: RouteStopType;
  pickup_id: number | null;
  warehouse_id: number | null;
  arrival_time: string | null;
  departure_time: string | null;
  lat?: number | null;
  lng?: number | null;
  location_name?: string | null;
  address?: string | null;
  estimated_weight_kg?: number | null;
}

export interface RouteResponse {
  id: number;
  route_code: string;
  route_date: string;
  warehouse_id: number;
  driver_id: number | null;
  vehicle_id: number | null;
  status: RouteStatus;
  planned_distance_km: number | null;
  planned_duration_seconds: number | null;
  optimized_at: string | null;
  approved_at?: string | null;
  approved_by_id?: number | null;
  optimization_run_id?: number | null;
  is_approved?: boolean;
  created_at: string;
  updated_at: string;
  stops: RouteStopResponse[];
  driver?: any;
  vehicle?: any;
}

export interface RouteCreate {
  warehouse_id: number;
  route_date: string;
  pickup_ids: number[];
}

export interface RouteUpdate {
  route_date?: string;
  driver_id?: number | null;
  vehicle_id?: number | null;
  status?: RouteStatus;
  warehouse_id?: number;
}

export interface OptimizeRoutesRequest {
  warehouse_id: number;
  route_date: string;
  batch_id?: number;
  num_vehicles?: number;
  vehicle_capacity_kg?: number;
  max_distance_km?: number;
  max_duration_minutes?: number;
  service_time_minutes?: number;
  local_backward_allowance_km?: number;
  selected_pickup_ids?: number[];
  auto_dispatch?: boolean;
  rerun?: boolean;
}

export interface OptimizationBatchCreate {
  warehouse_id: number;
  pickup_ids: number[];
  planning_date?: string;
}

export interface OptimizationBatchResponse {
  batch_id: number;
  batch_code: string;
  planning_date: string;
  warehouse_id: number;
  status: string;
  pickup_count: number;
  pickup_ids: number[];
  created_at: string;
  created_by_id?: number | null;
  routes_created: number;
}

export interface OptimizationBatchPickup {
  id: number;
  pickup_code: string;
  customer_id: number;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  address_line1: string;
  city: string;
  estimated_weight_kg: number;
  priority: PickupPriority;
  status: PickupStatus;
  scheduled_date: string | null;
}

export interface OptimizationBatchDetailResponse {
  batch_id: number;
  batch_code: string;
  planning_date: string;
  warehouse_id: number;
  status: string;
  pickup_count: number;
  pickup_ids: number[];
  created_at: string;
  created_by_id?: number | null;
  routes_created: number;
  pickups: OptimizationBatchPickup[];
  routes: OptimizedRouteSummary[];
  summary_metrics?: {
    total_distance_km?: number;
    max_duration_minutes?: number;
  } | null;
}


export interface RouteAssignRequest {
  driver_id: number;
  vehicle_id: number;
  notes?: string;
}

export interface RouteReassignRequest {
  driver_id: number;
  vehicle_id: number;
  reason: string;
}

export interface RouteBulkApproveRequest {
  route_ids: number[];
}

export interface RouteBulkApproveResponse {
  approved_count: number;
  failed_count: number;
  results: { route_id: number; success: boolean; error?: string | null }[];
}

export interface RouteBulkDispatchItem {
  route_id: number;
  success: boolean;
  status: string;
  error?: string | null;
}

export interface RouteBulkDispatchResponse {
  dispatched_count: number;
  failed_count: number;
  results: RouteBulkDispatchItem[];
}

export interface OptimizedStopLocation {
  pickup_id: number;
  sequence_number: number;
  location_name: string;
  lat: number;
  lng: number;
  estimated_weight_kg: number | null;
}

export interface OptimizedRouteSummary {
  route_id: number;
  route_code: string;
  driver_id?: number | null;
  vehicle_id?: number | null;
  pickup_ids: number[];
  distance_km: number;
  duration_minutes: number;
  load_kg: number;
  stop_locations: OptimizedStopLocation[];
  polyline?: number[][];
  backtrack_km?: number;
  status?: string;
  is_approved?: boolean;
}

export interface PlanningReadinessResponse {
  planning_date: string;
  timezone: string;
  total_pickups_requested_tomorrow: number;
  eligible_pickups_awaiting_selection: number;
  pickups_allocated_to_routes: number;
  pickups_excluded_count: number;
  pickups_excluded: {
    pickup_id: number;
    pickup_code: string;
    customer_id: number;
    customer_name?: string | null;
    scheduled_date?: string | null;
    reason: string;
  }[];
  routes_awaiting_review: number;
  routes_awaiting_assignment: number;
  routes_awaiting_dispatch: number;
  total_demand_kg: number;
  available_fleet_capacity_kg: number;
  capacity_shortfall_kg: number;
  is_ready_for_dispatch: boolean;
  blockers: string[];
  latest_run?: any;
}

export interface OptimizationRunSummary {
  id: number;
  run_code: string;
  planning_date: string;
  warehouse_id: number;
  status: string;
  routes_created: number;
  pickups_assigned: number;
  created_at: string;
  unassigned_count?: number;
}

export interface AuditLogItem {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  entity_code: string | null;
  actor_id: number | null;
  actor_name: string | null;
  actor_role?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

export interface AuditLogResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PickupHistoryItem {
  id: number;
  public_id: string;
  pickup_code: string;
  customer_id: number;
  customer_name?: string | null;
  location_id: number;
  location_name?: string | null;
  location_address?: string | null;
  status: PickupStatus;
  priority: PickupPriority;
  requested_date?: string | null;
  scheduled_date?: string | null;
  collected_at?: string | null;
  estimated_weight_kg?: number | null;
  collected_weight_kg?: number | null;
  failure_reason?: string | null;
  route_id?: number | null;
  route_code?: string | null;
  driver_id?: number | null;
  driver_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PickupHistoryResponse {
  items: PickupHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}


export interface OptimizeRoutesResponse {
  route_date: string;
  warehouse_id: number;
  warehouse_coordinates?: number[];
  vehicles_available: number;
  routes_created: number;
  pickups_assigned: number;
  unassigned_pickups?: { pickup_id: number; reason: string }[];
  total_fleet_distance_km?: number;
  max_route_duration_minutes?: number;
  vehicle_utilization_pct?: number;
  cross_vehicle_overlap_km?: number;
  routes: OptimizedRouteSummary[];
  routing_source: string;
  optimization_run_id?: number | null;
  optimization_run_code?: string | null;
  planning_date?: string | null;
}

// ==========================================
// Warehouses & Intakes
// ==========================================
export interface WarehouseResponse {
  id: number;
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarehouseCreate {
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
}

export interface WarehouseUpdate {
  code?: string | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  active?: boolean | null;
}

export interface WarehouseIntakeItemRequest {
  bin_color: WasteBinColor;
  waste_type: WasteType;
  expected_weight_kg: number;
  received_weight_kg: number;
  notes?: string | null;
}

export interface WarehouseIntakeItemResponse {
  id: number;
  intake_id: number;
  bin_color: WasteBinColor;
  waste_type: WasteType;
  expected_weight_kg: number;
  received_weight_kg: number | null;
  notes: string | null;
  created_at: string;
}

export interface WarehouseClassifyRequest {
  items: WarehouseIntakeItemRequest[];
}

export interface WarehouseReceiveRequest {
  received_weight_kg: number;
  discrepancy_reason?: string | null;
  notes?: string | null;
}

export interface WarehouseIntakeResponse {
  id: number;
  intake_code: string;
  route_id: number;
  warehouse_id: number;
  driver_id: number;
  vehicle_id: number;
  status: WarehouseIntakeStatus;
  expected_weight_kg: number;
  received_weight_kg: number | null;
  received_at: string | null;
  discrepancy_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: WarehouseIntakeItemResponse[];
}

export interface WarehouseIntakeCreate {
  intake_code?: string | null;
  route_id: number;
  warehouse_id: number;
  driver_id: number;
  vehicle_id: number;
  status?: WarehouseIntakeStatus;
  expected_weight_kg?: number;
  received_weight_kg?: number | null;
  discrepancy_reason?: string | null;
  notes?: string | null;
}

export interface WarehouseIntakeUpdate {
  status?: WarehouseIntakeStatus;
  received_weight_kg?: number | null;
  discrepancy_reason?: string | null;
  notes?: string | null;
}

// ==========================================
// Facilities & Shipments
// ==========================================
export interface FacilityResponse {
  id: number;
  user_id: number;
  facility_code: string;
  legal_name: string;
  phone: string;
  email: string;
  license_number: string;
  license_expiry: string | null;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FacilityCreate {
  user_id: number;
  facility_code: string;
  legal_name: string;
  phone: string;
  email: string;
  license_number: string;
  license_expiry?: string | null;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
}

export interface FacilityUpdate {
  facility_code?: string | null;
  legal_name?: string | null;
  phone?: string | null;
  email?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  active?: boolean;
}

export interface DisposalShipmentItemCreate {
  warehouse_intake_item_id: number;
  expected_weight_kg: number;
}

export interface DisposalShipmentCreate {
  intake_id: number;
  facility_id: number;
  items: DisposalShipmentItemCreate[];
  notes?: string | null;
}

export interface DisposalShipmentItemResponse {
  id: number;
  warehouse_intake_item_id: number;
  expected_weight_kg: DecimalString;
  received_weight_kg: DecimalString | null;
  notes: string | null;
}

export interface DisposalShipmentResponse {
  id: number;
  public_id: string;
  shipment_code: string;
  intake_id: number;
  facility_id: number;
  status: DisposalShipmentStatus;
  expected_weight_kg: DecimalString;
  received_weight_kg: DecimalString | null;
  dispatched_at: string | null;
  received_at: string | null;
  discrepancy_reason: string | null;
  notes: string | null;
  items: DisposalShipmentItemResponse[];
}

export interface DisposalShipmentUpdate {
  status?: DisposalShipmentStatus;
  facility_id?: number;
  dispatched_at?: string | null;
  received_at?: string | null;
  received_weight_kg?: number | null;
  discrepancy_reason?: string | null;
  notes?: string | null;
}

// ==========================================
// Operational Exceptions
// ==========================================
export interface OperationalExceptionResponse {
  id: number;
  exception_type: OperationalExceptionType;
  status: OperationalExceptionStatus;
  source_type: string;
  source_id: number;
  reason: string;
  opened_at: string;
  escalated_at: string | null;
  resolved_at: string | null;
  resolved_by_user_id: number | null;
  resolution_notes: string | null;
}

export interface OperationalExceptionCreate {
  exception_type: OperationalExceptionType;
  source_type: string;
  source_id: number;
  reason: string;
  status?: OperationalExceptionStatus;
}

export interface OperationalExceptionUpdate {
  status?: OperationalExceptionStatus;
  reason?: string;
  resolution_notes?: string | null;
}

export interface OperationalExceptionResolveRequest {
  resolution_notes: string;
}

// ==========================================
// Customer Documents
// ==========================================
export interface CustomerDocumentResponse {
  id: number;
  customer_id: number;
  document_type: CustomerDocumentType;
  document_number: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface CustomerDocumentCreate {
  customer_id: number;
  document_type: CustomerDocumentType;
  document_number?: string | null;
  file_path?: string;
  is_verified?: boolean;
}

// ==========================================
// Runtime Configuration & Audit
// ==========================================
export interface ConfigurationVersionResponse {
  id: number;
  configuration_id: number;
  version: number;
  value: JsonValue;
  status: string;
  effective_from: string | null;
  effective_until: string | null;
  created_by: number;
  approved_by: number | null;
  reason: string | null;
  change_reference: string | null;
  previous_version_id: number | null;
  rollback_of_version_id: number | null;
  created_at: string;
  approved_at: string | null;
}

export interface ConfigurationResponse {
  id: number;
  key: string;
  description: string | null;
  data_type: string;
  scope: string;
  scope_id: number | null;
  current_version_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConfigurationDetailResponse extends ConfigurationResponse {
  current_version: ConfigurationVersionResponse | null;
}

export interface ConfigurationHistoryResponse {
  configuration: ConfigurationResponse;
  versions: ConfigurationVersionResponse[];
}

export interface ConfigurationCreate {
  key: string;
  description?: string | null;
  data_type?: string;
  scope?: string;
  scope_id?: number | null;
  initial_value?: JsonValue;
  is_active?: boolean;
}

export interface ConfigurationChangeCreate {
  configuration_id: number;
  proposed_value?: JsonValue;
  risk_level?: string;
  reason: string;
  change_reference?: string | null;
  effective_from?: string | null;
}

export interface ConfigurationChangeReview {
  comment?: string | null;
}

export interface ConfigurationRollbackCreate {
  rollback_to_version_id: number;
  reason: string;
  change_reference?: string | null;
  effective_from?: string | null;
}

export interface ConfigurationChangeResponse {
  id: number;
  configuration_id: number;
  base_version_id: number | null;
  proposed_value: JsonValue;
  status: string;
  risk_level: string;
  reason: string;
  change_reference: string | null;
  effective_from: string | null;
  created_by: number;
  approved_by: number | null;
  rejected_by: number | null;
  review_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
  rollback_of_version_id: number | null;
}

export interface ConfigurationAuditResponse {
  id: number;
  configuration_id: number;
  configuration_version_id: number | null;
  change_request_id: number | null;
  actor_id: number;
  action: string;
  old_value: JsonValue;
  new_value: JsonValue;
  reason: string | null;
  change_reference: string | null;
  created_at: string;
}

// ==========================================
// WhatsApp Templates
// ==========================================
export interface WhatsAppTemplateCreate {
  notification_type: NotificationType;
  template_key: string;
  meta_template_name: string;
  language_code?: string;
  parameter_keys?: string[];
  is_active?: boolean;
}

export interface WhatsAppTemplateUpdate {
  template_key?: string | null;
  meta_template_name?: string | null;
  language_code?: string | null;
  parameter_keys?: string[] | null;
  is_active?: boolean | null;
}

export interface WhatsAppTemplateResponse {
  id: number;
  notification_type: NotificationType;
  template_key: string;
  meta_template_name: string;
  language_code: string;
  parameter_keys: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ==========================================
// Fleet: Drivers & Vehicles
// ==========================================
export interface DriverCreate {
  user_id: number;
  employee_id: string;
  phone: string;
  license_number: string;
  license_expiry?: string | null;
}

export interface DriverUpdate {
  employee_id?: string | null;
  phone?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  status?: DriverStatus | null;
  is_available?: boolean | null;
}

export interface DriverResponse {
  id: number;
  user_id: number;
  employee_id: string;
  phone: string;
  license_number: string;
  license_expiry: string | null;
  status: DriverStatus;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriverOnboardRequest {
  email: string;
  name: string;
  employee_id: string;
  phone: string;
  license_number: string;
  license_expiry?: string | null;
}

export interface DriverOnboardResponse {
  driver_id: number;
  user_id: number;
  auth_user_id: string;
  message: string;
}

export interface VehicleCreate {
  registration_number: string;
  vehicle_type: VehicleType;
  capacity_kg?: number | null;
}

export interface VehicleUpdate {
  registration_number?: string | null;
  vehicle_type?: VehicleType | null;
  capacity_kg?: number | null;
  status?: VehicleStatus | null;
}

export interface VehicleResponse {
  id: number;
  registration_number: string;
  vehicle_type: VehicleType;
  capacity_kg: DecimalString;
  status: VehicleStatus;
  created_at: string;
  updated_at: string;
}

export interface DriverVehicleAssignmentCreate {
  driver_id: number;
  vehicle_id: number;
  notes?: string | null;
}

export interface DriverVehicleAssignmentResponse {
  id: number;
  driver_id: number;
  vehicle_id: number;
  assigned_at: string;
  unassigned_at: string | null;
  notes: string | null;
}

// ==========================================
// Invoices & Payments
// ==========================================
export interface InvoiceLineItemResponse {
  id: number;
  invoice_id: number;
  item_type: string;
  description: string;
  quantity: DecimalString;
  unit_price: DecimalString;
  amount: DecimalString;
  metadata_json: Record<string, JsonValue>;
  created_at: string;
}

export interface InvoiceLineItemCreate {
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  metadata_json?: Record<string, JsonValue>;
}

export interface InvoiceCreate {
  customer_id: number;
  pickup_id: number;
  pricing_plan_id?: number | null;
  pricing_plan_version_id?: number | null;
  currency?: string;
  tax_amount?: number;
  due_date?: string | null;
  notes?: string | null;
  line_items?: InvoiceLineItemCreate[];
}

export interface InvoiceUpdate {
  status?: string;
  due_date?: string | null;
  notes?: string | null;
}

export interface InvoiceResponse {
  id: number;
  public_id: string;
  invoice_number: string;
  customer_id: number;
  customer_public_id: string;
  pickup_id: number;
  pricing_plan_id: number;
  pricing_plan_version_id: number;
  currency: string;
  subtotal: DecimalString;
  tax_amount: DecimalString;
  total_amount: DecimalString;
  amount_paid: DecimalString;
  outstanding_amount: DecimalString;
  status: string;
  issued_at: string;
  due_date: string | null;
  paid_at: string | null;
  pricing_snapshot: Record<string, JsonValue>;
  notes: string | null;
  created_at: string;
  updated_at: string;
  line_items: InvoiceLineItemResponse[];
}

export interface PaymentCreate {
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_reference?: string | null;
  notes?: string | null;
}

export interface PaymentResponse {
  id: number;
  invoice_id: string;
  amount: DecimalString;
  payment_method: string;
  status: string;
  payment_reference: string | null;
  idempotency_key: string | null;
  notes: string | null;
  paid_at: string;
  created_at: string;
}

// ==========================================
// Notifications
// ==========================================
export interface NotificationResponse {
  id: number;
  notification_type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  metadata: Record<string, JsonValue> | null;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
  provider_status: string | null;
  provider_status_at: string | null;
}
