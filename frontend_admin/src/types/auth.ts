export type UserRole = 'ADMIN' | 'DRIVER' | 'CUSTOMER' | 'FACILITY';

export interface User {
  id: number;
  auth_user_id: string;
  name: string;
  email: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
}

export interface AdminDashboardSummary {
  total_pickups: number;
  pending_pickups: number;
  today_scheduled_pickups: number;
  active_routes: number;
  pending_warehouse_intakes: number;
  open_exceptions: number;
  total_collected_weight_kg: number;
}
