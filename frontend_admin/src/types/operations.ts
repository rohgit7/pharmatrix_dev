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
}

export interface PickupScheduleRequest {
  scheduled_date: string;
}

export interface PickupCancelRequest {
  reason: string;
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
  created_at: string;
  updated_at: string;
  stops: RouteStopResponse[];
}

export interface RouteCreate {
  warehouse_id: number;
  route_date: string;
  pickup_ids: number[];
}

export interface OptimizeRoutesRequest {
  warehouse_id: number;
  route_date: string;
}

export interface OptimizedRouteSummary {
  route_id: number;
  route_code: string;
  driver_id: number;
  vehicle_id: number;
  pickup_ids: number[];
  distance_km: number;
  duration_minutes: number;
  load_kg: number;
}

export interface OptimizeRoutesResponse {
  route_date: string;
  warehouse_id: number;
  vehicles_available: number;
  routes_created: number;
  pickups_assigned: number;
  routes: OptimizedRouteSummary[];
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
