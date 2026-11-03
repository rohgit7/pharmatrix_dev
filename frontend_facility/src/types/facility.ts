export type UserRole = 'ADMIN' | 'DRIVER' | 'CUSTOMER' | 'FACILITY';

export interface FacilityUser {
  id: number;
  auth_user_id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

export interface FacilityProfile {
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

export interface FacilityLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
  user: FacilityUser;
  facility: FacilityProfile;
}

export type DisposalShipmentStatus =
  | 'CREATED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'DISCREPANCY'
  | 'CANCELLED'
  | 'DISPOSED';

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

export interface DisposalShipmentItem {
  id: number;
  warehouse_intake_item_id: number;
  expected_weight_kg: string | number;
  received_weight_kg: string | number | null;
  notes: string | null;
  bin_color?: WasteBinColor | string | null;
  waste_type?: WasteType | string | null;
}

export interface ShipmentPickupSummary {
  pickup_id: number;
  pickup_code: string;
  generator_code?: string | null;
  generator_type?: string | null;
  city?: string | null;
  estimated_weight_kg?: number | null;
  collected_weight_kg?: number | null;
  status: string;
  collected_at?: string | null;
}

export interface ShipmentCertificateInfo {
  id: number;
  public_id: string;
  certificate_code: string;
  certificate_number: string;
  file_name: string;
  content_type: string;
  storage_path: string;
  issued_at: string;
  uploaded_at: string;
  notes: string | null;
}

export interface DisposalShipment {
  id: number;
  public_id: string;
  shipment_code: string;
  intake_id: number;
  facility_id: number;
  status: DisposalShipmentStatus;
  expected_weight_kg: string | number;
  received_weight_kg: string | number | null;
  dispatched_at: string | null;
  received_at: string | null;
  discrepancy_reason: string | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  intake_code?: string | null;
  warehouse_id?: number | null;
  warehouse_code?: string | null;
  warehouse_name?: string | null;
  warehouse_city?: string | null;
  warehouse_address?: string | null;
  route_code?: string | null;
  vehicle_registration?: string | null;
  pickup_count?: number;
  pickups_summary?: ShipmentPickupSummary[];
  certificate_info?: ShipmentCertificateInfo | null;
  items: DisposalShipmentItem[];
}

export interface DisposalShipmentReceiveItemPayload {
  shipment_item_id: number;
  received_weight_kg: number | string;
  notes?: string | null;
}

export interface DisposalShipmentReceivePayload {
  items: DisposalShipmentReceiveItemPayload[];
  notes?: string | null;
  discrepancy_reason?: string | null;
}

export interface DisposalShipmentDisposalRecordPayload {
  disposal_date: string;
  disposed_weight_kg: number | string;
  disposal_method?: string | null;
  notes?: string | null;
  mark_disposed?: boolean;
}

export interface DisposalCertificate {
  id: number;
  public_id: string;
  certificate_code: string;
  shipment_id: string;
  certificate_number: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  issued_at: string;
  uploaded_at: string;
  notes: string | null;
}

export interface DisposalCertificateUrlResponse {
  url: string;
  expires_in: number;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  notification_type: string;
  channel: string;
  status: string;
  title: string;
  body: string;
  created_at: string;
  sent_at: string | null;
  read_at: string | null;
}

