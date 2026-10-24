import { apiClient } from './client';
import { AdminDashboardSummary } from '../types/auth';
import {
  PickupAdminResponse,
  PickupAdminCreate,
  PickupAdminUpdate,
  PickupStatus,
  PickupHistoryResponse,
  RouteResponse,
  RouteStatus,
  RouteCreate,
  RouteUpdate,
  RouteAssignRequest,
  RouteReassignRequest,
  RouteBulkApproveResponse,
  RouteBulkDispatchResponse,
  OptimizeRoutesRequest,
  OptimizeRoutesResponse,
  OptimizationBatchCreate,
  OptimizationBatchResponse,
  OptimizationBatchDetailResponse,
  PlanningReadinessResponse,
  OptimizationRunSummary,
  AuditLogResponse,
  WarehouseResponse,
  WarehouseCreate,
  WarehouseUpdate,
  WarehouseIntakeResponse,
  WarehouseIntakeCreate,
  WarehouseIntakeUpdate,
  WarehouseReceiveRequest,
  WarehouseClassifyRequest,
  FacilityResponse,
  FacilityCreate,
  FacilityUpdate,
  DisposalShipmentCreate,
  DisposalShipmentUpdate,
  DisposalShipmentResponse,
  DisposalCertificateResponse,
  DisposalCertificateCreate,
  OperationalExceptionResponse,
  OperationalExceptionCreate,
  OperationalExceptionUpdate,
  OperationalExceptionStatus,
  OperationalExceptionType,
  CustomerResponse,
  CustomerDetailResponse,
  CustomerCreate,
  CustomerUpdate,
  CustomerLocationResponse,
  CustomerLocationCreate,
  CustomerLocationUpdate,
  UserResponse,
  UserCreate,
  UserUpdate,
  PricingPlanResponse,
  PricingPlanCreate,
  PricingPlanUpdate,
  PricingPlanVersionResponse,
  PricingPlanVersionCreate,
  CustomerPricingAssignmentResponse,
  CustomerPricingAssignmentCreate,
  CustomerDocumentResponse,
  CustomerDocumentCreate,
  ConfigurationResponse,
  ConfigurationDetailResponse,
  ConfigurationHistoryResponse,
  ConfigurationCreate,
  ConfigurationChangeCreate,
  ConfigurationChangeResponse,
  ConfigurationRollbackCreate,
  ConfigurationAuditResponse,
  WhatsAppTemplateResponse,
  WhatsAppTemplateCreate,
  WhatsAppTemplateUpdate,
  DriverResponse,
  DriverCreate,
  DriverUpdate,
  DriverOnboardRequest,
  DriverOnboardResponse,
  VehicleResponse,
  VehicleCreate,
  VehicleUpdate,
  DriverVehicleAssignmentCreate,
  DriverVehicleAssignmentResponse,
  InvoiceResponse,
  InvoiceCreate,
  InvoiceUpdate,
  PaymentResponse,
  PaymentCreate,
  NotificationResponse,
} from '../types/operations';

// ----------------------------------------------------
// Dashboard & Health
// ----------------------------------------------------
export const dashboardApi = {
  getSummary: async (): Promise<AdminDashboardSummary> => {
    const { data } = await apiClient.get<AdminDashboardSummary>('/api/admin/dashboard/summary');
    return data;
  },

  getHealth: async (): Promise<{ status: string; service: string }> => {
    const { data } = await apiClient.get<{ status: string; service: string }>('/health');
    return data;
  },

  getDbHealth: async (): Promise<{ database: string }> => {
    const { data } = await apiClient.get<{ database: string }>('/health/db');
    return data;
  },
};

// ----------------------------------------------------
// Customers & Locations (Full Admin CRUD)
// ----------------------------------------------------
export const customersApi = {
  list: async (skip = 0, limit = 100): Promise<CustomerResponse[]> => {
    const { data } = await apiClient.get<CustomerResponse[]>('/api/admin/customers/', {
      params: { skip, limit },
    });
    return data;
  },

  getById: async (id: number): Promise<CustomerDetailResponse> => {
    const { data } = await apiClient.get<CustomerDetailResponse>(`/api/admin/customers/${id}`);
    return data;
  },

  create: async (payload: CustomerCreate): Promise<CustomerResponse> => {
    const { data } = await apiClient.post<CustomerResponse>('/api/admin/customers/', payload);
    return data;
  },

  update: async (id: number, payload: CustomerUpdate): Promise<CustomerResponse> => {
    const { data } = await apiClient.patch<CustomerResponse>(`/api/admin/customers/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<{ message: string; customer_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; customer_id: number }>(`/api/admin/customers/${id}`);
    return data;
  },

  listLocations: async (customerId: number): Promise<CustomerLocationResponse[]> => {
    const { data } = await apiClient.get<CustomerLocationResponse[]>(`/api/admin/customers/${customerId}/locations`);
    return data;
  },

  createLocation: async (customerId: number, payload: CustomerLocationCreate): Promise<CustomerLocationResponse> => {
    const { data } = await apiClient.post<CustomerLocationResponse>(`/api/admin/customers/${customerId}/locations`, payload);
    return data;
  },

  updateLocation: async (locationId: number, payload: CustomerLocationUpdate): Promise<CustomerLocationResponse> => {
    const { data } = await apiClient.patch<CustomerLocationResponse>(`/api/admin/customers/locations/${locationId}`, payload);
    return data;
  },

  deleteLocation: async (locationId: number): Promise<{ message: string; location_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; location_id: number }>(`/api/admin/customers/locations/${locationId}`);
    return data;
  },
};

// ----------------------------------------------------
// Users & Roles Management (Full Admin CRUD)
// ----------------------------------------------------
export const usersApi = {
  list: async (role?: string, skip = 0, limit = 100): Promise<UserResponse[]> => {
    const { data } = await apiClient.get<UserResponse[]>('/api/admin/users/', {
      params: { role, skip, limit },
    });
    return data;
  },

  getById: async (id: number): Promise<UserResponse> => {
    const { data } = await apiClient.get<UserResponse>(`/api/admin/users/${id}`);
    return data;
  },

  create: async (payload: UserCreate): Promise<UserResponse> => {
    const { data } = await apiClient.post<UserResponse>('/api/admin/users/', payload);
    return data;
  },

  update: async (id: number, payload: UserUpdate): Promise<UserResponse> => {
    const { data } = await apiClient.patch<UserResponse>(`/api/admin/users/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<{ message: string; user_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; user_id: number }>(`/api/admin/users/${id}`);
    return data;
  },
};

// ----------------------------------------------------
// Pricing Plans & Assignments (Full Admin CRUD)
// ----------------------------------------------------
export const pricingApi = {
  listPlans: async (includeInactive = true): Promise<PricingPlanResponse[]> => {
    const { data } = await apiClient.get<PricingPlanResponse[]>('/api/admin/pricing/plans', {
      params: { include_inactive: includeInactive },
    });
    return data;
  },

  getPlan: async (id: number): Promise<PricingPlanResponse> => {
    const { data } = await apiClient.get<PricingPlanResponse>(`/api/admin/pricing/plans/${id}`);
    return data;
  },

  createPlan: async (payload: PricingPlanCreate): Promise<PricingPlanResponse> => {
    const { data } = await apiClient.post<PricingPlanResponse>('/api/admin/pricing/plans', payload);
    return data;
  },

  updatePlan: async (id: number, payload: PricingPlanUpdate): Promise<PricingPlanResponse> => {
    const { data } = await apiClient.patch<PricingPlanResponse>(`/api/admin/pricing/plans/${id}`, payload);
    return data;
  },

  deletePlan: async (id: number): Promise<{ message: string; plan_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; plan_id: number }>(`/api/admin/pricing/plans/${id}`);
    return data;
  },

  createVersion: async (planId: number, payload: PricingPlanVersionCreate): Promise<PricingPlanVersionResponse> => {
    const { data } = await apiClient.post<PricingPlanVersionResponse>(`/api/admin/pricing/plans/${planId}/versions`, payload);
    return data;
  },

  updateVersionStatus: async (versionId: number, status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'): Promise<PricingPlanVersionResponse> => {
    const { data } = await apiClient.patch<PricingPlanVersionResponse>(`/api/admin/pricing/versions/${versionId}/status`, null, {
      params: { status },
    });
    return data;
  },

  listAssignments: async (customerId?: number): Promise<CustomerPricingAssignmentResponse[]> => {
    const { data } = await apiClient.get<CustomerPricingAssignmentResponse[]>('/api/admin/pricing/assignments', {
      params: customerId ? { customer_id: customerId } : undefined,
    });
    return data;
  },

  createAssignment: async (payload: CustomerPricingAssignmentCreate): Promise<CustomerPricingAssignmentResponse> => {
    const { data } = await apiClient.post<CustomerPricingAssignmentResponse>('/api/admin/pricing/assignments', payload);
    return data;
  },

  deleteAssignment: async (id: number): Promise<{ message: string; assignment_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; assignment_id: number }>(`/api/admin/pricing/assignments/${id}`);
    return data;
  },
};

// ----------------------------------------------------
// Disposal Certificates (Full Admin CRUD)
// ----------------------------------------------------
export const disposalCertificatesApi = {
  list: async (facilityId?: number): Promise<DisposalCertificateResponse[]> => {
    const { data } = await apiClient.get<DisposalCertificateResponse[]>('/api/admin/disposal-certificates/', {
      params: facilityId ? { facility_id: facilityId } : undefined,
    });
    return data;
  },

  getById: async (id: number): Promise<DisposalCertificateResponse> => {
    const { data } = await apiClient.get<DisposalCertificateResponse>(`/api/admin/disposal-certificates/${id}`);
    return data;
  },

  getDownloadUrl: async (id: number): Promise<{ certificate_id: number; certificate_number: string; download_url: string; expires_in: number }> => {
    const { data } = await apiClient.get<{ certificate_id: number; certificate_number: string; download_url: string; expires_in: number }>(
      `/api/admin/disposal-certificates/${id}/url`
    );
    return data;
  },

  upload: async (payload: DisposalCertificateCreate): Promise<DisposalCertificateResponse> => {
    const { data } = await apiClient.post<DisposalCertificateResponse>('/api/admin/disposal-certificates/', payload);
    return data;
  },

  delete: async (id: number): Promise<{ message: string; certificate_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; certificate_id: number }>(`/api/admin/disposal-certificates/${id}`);
    return data;
  },
};

// ----------------------------------------------------
// Pickups (Full Admin CRUD)
// ----------------------------------------------------
export const pickupsApi = {
  list: async (
    paramsOrStatus?: PickupStatus | {
      status?: PickupStatus;
      work_queue?: boolean;
      planning_date?: string;
      operational_state?: string;
    }
  ): Promise<PickupAdminResponse[]> => {
    let params: any = undefined;
    if (typeof paramsOrStatus === 'string') {
      params = { status: paramsOrStatus };
    } else if (paramsOrStatus) {
      params = paramsOrStatus;
    }
    const { data } = await apiClient.get<PickupAdminResponse[]>('/api/admin/pickups/', {
      params,
    });
    return data;
  },

  getById: async (pickupId: string): Promise<PickupAdminResponse> => {
    const { data } = await apiClient.get<PickupAdminResponse>(`/api/admin/pickups/${pickupId}`);
    return data;
  },

  create: async (payload: PickupAdminCreate): Promise<PickupAdminResponse> => {
    const { data } = await apiClient.post<PickupAdminResponse>('/api/admin/pickups/', payload);
    return data;
  },

  update: async (pickupId: string, payload: PickupAdminUpdate): Promise<PickupAdminResponse> => {
    const { data } = await apiClient.patch<PickupAdminResponse>(`/api/admin/pickups/${pickupId}`, payload);
    return data;
  },

  delete: async (pickupId: string): Promise<{ message: string; pickup_id: string }> => {
    const { data } = await apiClient.delete<{ message: string; pickup_id: string }>(`/api/admin/pickups/${pickupId}`);
    return data;
  },

  schedule: async (pickupId: string, scheduledDate: string): Promise<PickupAdminResponse> => {
    const { data } = await apiClient.post<PickupAdminResponse>(`/api/admin/pickups/${pickupId}/schedule`, {
      scheduled_date: scheduledDate,
    });
    return data;
  },

  cancel: async (pickupId: string, reason: string): Promise<PickupAdminResponse> => {
    const { data } = await apiClient.post<PickupAdminResponse>(`/api/admin/pickups/${pickupId}/cancel`, {
      reason,
    });
    return data;
  },

  rescheduleNextDay: async (pickupId: string): Promise<PickupAdminResponse> => {
    const { data } = await apiClient.post<PickupAdminResponse>(`/api/admin/pickups/${pickupId}/reschedule-next-day`);
    return data;
  },

  getHistory: async (params?: {
    page?: number;
    page_size?: number;
    status?: PickupStatus;
    start_date?: string;
    end_date?: string;
    customer_id?: number;
    location_id?: number;
    search?: string;
  }): Promise<PickupHistoryResponse> => {
    const { data } = await apiClient.get<PickupHistoryResponse>('/api/admin/pickups/history', { params });
    return data;
  },
};

// ----------------------------------------------------
// Routes & Optimization (Full Admin CRUD)
// ----------------------------------------------------
export const routesApi = {
  list: async (
    paramsOrStatus?: RouteStatus | {
      status?: RouteStatus;
      active_only?: boolean;
      history_only?: boolean;
      planning_date?: string;
    }
  ): Promise<RouteResponse[]> => {
    let params: any = undefined;
    if (typeof paramsOrStatus === 'string') {
      params = { status: paramsOrStatus };
    } else if (paramsOrStatus) {
      params = paramsOrStatus;
    }
    const { data } = await apiClient.get<RouteResponse[]>('/api/admin/routes/', {
      params,
    });
    return data;
  },

  getReadiness: async (): Promise<PlanningReadinessResponse> => {
    const { data } = await apiClient.get<PlanningReadinessResponse>('/api/admin/routes/readiness');
    return data;
  },

  getHistory: async (params?: {
    start_date?: string;
    end_date?: string;
    status?: string;
  }): Promise<RouteResponse[]> => {
    const { data } = await apiClient.get<RouteResponse[]>('/api/admin/routes/history', { params });
    return data;
  },

  getById: async (routeId: number): Promise<RouteResponse> => {
    const { data } = await apiClient.get<RouteResponse>(`/api/admin/routes/${routeId}`);
    return data;
  },

  create: async (payload: RouteCreate): Promise<RouteResponse> => {
    const { data } = await apiClient.post<RouteResponse>('/api/admin/routes/', payload);
    return data;
  },

  update: async (routeId: number, payload: RouteUpdate): Promise<RouteResponse> => {
    const { data } = await apiClient.patch<RouteResponse>(`/api/admin/routes/${routeId}`, payload);
    return data;
  },

  delete: async (routeId: number): Promise<{ message: string; route_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; route_id: number }>(`/api/admin/routes/${routeId}`);
    return data;
  },

  optimize: async (payload: OptimizeRoutesRequest): Promise<OptimizeRoutesResponse> => {
    const { data } = await apiClient.post<OptimizeRoutesResponse>('/api/admin/routes/optimize', payload);
    return data;
  },

  getLatestRun: async (params?: { warehouse_id?: number; planning_date?: string }): Promise<any> => {
    const { data } = await apiClient.get('/api/admin/routes/runs/latest', { params });
    return data;
  },

  listRuns: async (params?: { warehouse_id?: number; limit?: number }): Promise<OptimizationRunSummary[]> => {
    const { data } = await apiClient.get<OptimizationRunSummary[]>('/api/admin/routes/runs', { params });
    return data;
  },

  approve: async (routeId: number, notes?: string): Promise<RouteResponse> => {
    const { data } = await apiClient.post<RouteResponse>(`/api/admin/routes/${routeId}/approve`, { notes });
    return data;
  },

  reject: async (routeId: number, reason?: string): Promise<{ message: string; route_id: number }> => {
    const { data } = await apiClient.post<{ message: string; route_id: number }>(`/api/admin/routes/${routeId}/reject`, { reason });
    return data;
  },

  bulkApprove: async (routeIds: number[]): Promise<RouteBulkApproveResponse> => {
    const { data } = await apiClient.post<RouteBulkApproveResponse>('/api/admin/routes/bulk-approve', {
      route_ids: routeIds,
    });
    return data;
  },

  submitBatch: async (payload: OptimizationBatchCreate): Promise<OptimizationBatchResponse> => {
    const { data } = await apiClient.post<OptimizationBatchResponse>('/api/admin/routes/batches', payload);
    return data;
  },

  getActiveBatch: async (params?: { warehouse_id?: number; planning_date?: string }): Promise<OptimizationBatchDetailResponse | null> => {
    const { data } = await apiClient.get<OptimizationBatchDetailResponse | null>('/api/admin/routes/batches/active', { params });
    return data;
  },

  getBatch: async (batchId: number): Promise<OptimizationBatchDetailResponse> => {
    const { data } = await apiClient.get<OptimizationBatchDetailResponse>(`/api/admin/routes/batches/${batchId}`);
    return data;
  },

  getProofUrl: async (stopId: number): Promise<{ stop_id: number; proof_uploaded: boolean; signed_url: string; expires_in: number }> => {
    const { data } = await apiClient.get(`/api/admin/collection-proofs/${stopId}/url`);
    return data;
  },

  assign: async (routeId: number, payload: RouteAssignRequest): Promise<RouteResponse> => {
    const { data } = await apiClient.post<RouteResponse>(`/api/admin/routes/${routeId}/assign`, payload);
    return data;
  },

  reassign: async (routeId: number, payload: RouteReassignRequest): Promise<RouteResponse> => {
    const { data } = await apiClient.post<RouteResponse>(`/api/admin/routes/${routeId}/reassign`, payload);
    return data;
  },

  unassign: async (routeId: number): Promise<RouteResponse> => {
    const { data } = await apiClient.post<RouteResponse>(`/api/admin/routes/${routeId}/unassign`);
    return data;
  },

  releasePickup: async (routeId: number, pickupId: number, reason?: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{ success: boolean; message: string }>(
      `/api/admin/routes/${routeId}/release/${pickupId}`,
      { reason: reason || 'Released from planning run' }
    );
    return data;
  },

  dispatch: async (routeId: number): Promise<RouteResponse> => {
    const { data } = await apiClient.post<RouteResponse>(`/api/admin/routes/${routeId}/dispatch`);
    return data;
  },

  bulkDispatch: async (routeIds: number[]): Promise<RouteBulkDispatchResponse> => {
    const { data } = await apiClient.post<RouteBulkDispatchResponse>('/api/admin/routes/bulk-dispatch', {
      route_ids: routeIds,
    });
    return data;
  },
};

// ----------------------------------------------------
// Operational Lifecycle Audit Logs
// ----------------------------------------------------
export const auditLogsApi = {
  list: async (params?: {
    page?: number;
    page_size?: number;
    action?: string;
    entity_type?: string;
    entity_id?: number;
    actor_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<AuditLogResponse> => {
    const { data } = await apiClient.get<AuditLogResponse>('/api/admin/audit-logs/', { params });
    return data;
  },
};

// ----------------------------------------------------
// Warehouses & Intakes (Full Admin CRUD)
// ----------------------------------------------------
export const warehousesApi = {
  list: async (includeInactive = false): Promise<WarehouseResponse[]> => {
    const { data } = await apiClient.get<WarehouseResponse[]>('/api/admin/warehouses/', {
      params: { include_inactive: includeInactive },
    });
    return data;
  },

  getById: async (id: number): Promise<WarehouseResponse> => {
    const { data } = await apiClient.get<WarehouseResponse>(`/api/admin/warehouses/${id}`);
    return data;
  },

  create: async (payload: WarehouseCreate): Promise<WarehouseResponse> => {
    const { data } = await apiClient.post<WarehouseResponse>('/api/admin/warehouses/', payload);
    return data;
  },

  update: async (id: number, payload: WarehouseUpdate): Promise<WarehouseResponse> => {
    const { data } = await apiClient.patch<WarehouseResponse>(`/api/admin/warehouses/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<{ message: string; warehouse_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; warehouse_id: number }>(`/api/admin/warehouses/${id}`);
    return data;
  },

  listIntakes: async (params?: { warehouse_id?: number; status?: string; limit?: number; offset?: number }): Promise<WarehouseIntakeResponse[]> => {
    const { data } = await apiClient.get<WarehouseIntakeResponse[]>('/api/admin/warehouse-intakes', { params });
    return data;
  },

  getIntake: async (intakeId: number): Promise<WarehouseIntakeResponse> => {
    const { data } = await apiClient.get<WarehouseIntakeResponse>(`/api/admin/warehouse-intakes/${intakeId}`);
    return data;
  },

  createIntake: async (payload: WarehouseIntakeCreate): Promise<WarehouseIntakeResponse> => {
    const { data } = await apiClient.post<WarehouseIntakeResponse>('/api/admin/warehouse-intakes/', payload);
    return data;
  },

  updateIntake: async (intakeId: number, payload: WarehouseIntakeUpdate): Promise<WarehouseIntakeResponse> => {
    const { data } = await apiClient.patch<WarehouseIntakeResponse>(`/api/admin/warehouse-intakes/${intakeId}`, payload);
    return data;
  },

  deleteIntake: async (intakeId: number): Promise<{ message: string; intake_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; intake_id: number }>(`/api/admin/warehouse-intakes/${intakeId}`);
    return data;
  },

  receiveIntake: async (
    intakeId: number,
    payload: WarehouseReceiveRequest
  ): Promise<WarehouseIntakeResponse> => {
    const { data } = await apiClient.post<WarehouseIntakeResponse>(
      `/api/admin/warehouse-intakes/${intakeId}/receive`,
      payload
    );
    return data;
  },

  classifyIntake: async (
    intakeId: number,
    payload: WarehouseClassifyRequest
  ): Promise<WarehouseIntakeResponse> => {
    const { data } = await apiClient.post<WarehouseIntakeResponse>(
      `/api/admin/warehouse-intakes/${intakeId}/classify`,
      payload
    );
    return data;
  },
};

// ----------------------------------------------------
// Facilities & Shipments (Full Admin CRUD)
// ----------------------------------------------------
export const facilitiesApi = {
  list: async (includeInactive = false): Promise<FacilityResponse[]> => {
    const { data } = await apiClient.get<FacilityResponse[]>('/api/admin/facilities/', {
      params: { include_inactive: includeInactive },
    });
    return data;
  },

  getById: async (id: number): Promise<FacilityResponse> => {
    const { data } = await apiClient.get<FacilityResponse>(`/api/admin/facilities/${id}`);
    return data;
  },

  create: async (payload: FacilityCreate): Promise<FacilityResponse> => {
    const { data } = await apiClient.post<FacilityResponse>('/api/admin/facilities/', payload);
    return data;
  },

  update: async (id: number, payload: FacilityUpdate): Promise<FacilityResponse> => {
    const { data } = await apiClient.patch<FacilityResponse>(`/api/admin/facilities/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<{ message: string; facility_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; facility_id: number }>(`/api/admin/facilities/${id}`);
    return data;
  },

  listShipments: async (params?: { limit?: number; offset?: number }): Promise<DisposalShipmentResponse[]> => {
    const { data } = await apiClient.get<DisposalShipmentResponse[]>('/api/admin/disposal-shipments', { params });
    return data;
  },

  getShipment: async (shipmentId: string): Promise<DisposalShipmentResponse> => {
    const { data } = await apiClient.get<DisposalShipmentResponse>(`/api/admin/disposal-shipments/${shipmentId}`);
    return data;
  },

  createShipment: async (payload: DisposalShipmentCreate): Promise<DisposalShipmentResponse> => {
    const { data } = await apiClient.post<DisposalShipmentResponse>('/api/admin/disposal-shipments/', payload);
    return data;
  },

  updateShipment: async (shipmentId: string, payload: DisposalShipmentUpdate): Promise<DisposalShipmentResponse> => {
    const { data } = await apiClient.patch<DisposalShipmentResponse>(`/api/admin/disposal-shipments/${shipmentId}`, payload);
    return data;
  },

  deleteShipment: async (shipmentId: string): Promise<{ message: string; shipment_id: string }> => {
    const { data } = await apiClient.delete<{ message: string; shipment_id: string }>(`/api/admin/disposal-shipments/${shipmentId}`);
    return data;
  },

  dispatchShipment: async (shipmentId: string): Promise<DisposalShipmentResponse> => {
    const { data } = await apiClient.post<DisposalShipmentResponse>(
      `/api/admin/disposal-shipments/${shipmentId}/dispatch`
    );
    return data;
  },
};

// ----------------------------------------------------
// Exceptions (Full Admin CRUD)
// ----------------------------------------------------
export const exceptionsApi = {
  list: async (filters?: { status?: OperationalExceptionStatus; exception_type?: OperationalExceptionType }): Promise<OperationalExceptionResponse[]> => {
    const { data } = await apiClient.get<OperationalExceptionResponse[]>('/api/admin/exceptions/', {
      params: filters,
    });
    return data;
  },

  getById: async (id: number): Promise<OperationalExceptionResponse> => {
    const { data } = await apiClient.get<OperationalExceptionResponse>(`/api/admin/exceptions/${id}`);
    return data;
  },

  create: async (payload: OperationalExceptionCreate): Promise<OperationalExceptionResponse> => {
    const { data } = await apiClient.post<OperationalExceptionResponse>('/api/admin/exceptions/', payload);
    return data;
  },

  escalate: async (id: number): Promise<OperationalExceptionResponse> => {
    const { data } = await apiClient.post<OperationalExceptionResponse>(`/api/admin/exceptions/${id}/escalate`);
    return data;
  },

  update: async (id: number, payload: OperationalExceptionUpdate): Promise<OperationalExceptionResponse> => {
    const { data } = await apiClient.patch<OperationalExceptionResponse>(`/api/admin/exceptions/${id}`, payload);
    return data;
  },

  resolve: async (id: number, resolutionNotes: string): Promise<OperationalExceptionResponse> => {
    const { data } = await apiClient.post<OperationalExceptionResponse>(`/api/admin/exceptions/${id}/resolve`, {
      resolution_notes: resolutionNotes,
    });
    return data;
  },

  delete: async (id: number): Promise<{ message: string; exception_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; exception_id: number }>(`/api/admin/exceptions/${id}`);
    return data;
  },
};

// ----------------------------------------------------
// Customer Documents (Full Admin CRUD)
// ----------------------------------------------------
export const customerDocumentsApi = {
  list: async (): Promise<CustomerDocumentResponse[]> => {
    const { data } = await apiClient.get<CustomerDocumentResponse[]>('/api/admin/customer-documents/');
    return data;
  },

  create: async (payload: CustomerDocumentCreate & { file?: File }): Promise<CustomerDocumentResponse> => {
    const formData = new FormData();
    formData.append('customer_id', String(payload.customer_id));
    formData.append('document_type', payload.document_type);
    if (payload.document_number) formData.append('document_number', payload.document_number);
    if (payload.file_path) formData.append('document_url', payload.file_path);
    if (payload.is_verified !== undefined) formData.append('is_verified', String(payload.is_verified));
    if (payload.file) formData.append('file', payload.file);
    const { data } = await apiClient.post<CustomerDocumentResponse>('/api/admin/customer-documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  setVerification: async (documentId: number, verified: boolean): Promise<{ id: number; is_verified: boolean }> => {
    const { data } = await apiClient.patch<{ id: number; is_verified: boolean }>(
      `/api/admin/customer-documents/${documentId}/verification`,
      null,
      { params: { verified } }
    );
    return data;
  },

  getDownloadUrl: async (documentId: number): Promise<{ download_url: string }> => {
    const { data } = await apiClient.get<{ download_url: string }>(
      `/api/admin/customer-documents/${documentId}/download`
    );
    return data;
  },

  delete: async (documentId: number): Promise<{ message: string; document_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; document_id: number }>(`/api/admin/customer-documents/${documentId}`);
    return data;
  },
};

// ----------------------------------------------------
// Runtime Configuration & Audit (Full Admin CRUD)
// ----------------------------------------------------
export const configurationApi = {
  list: async (): Promise<ConfigurationResponse[]> => {
    const { data } = await apiClient.get<ConfigurationResponse[]>('/api/admin/configuration');
    return data;
  },

  getDetail: async (key: string): Promise<ConfigurationDetailResponse> => {
    const { data } = await apiClient.get<ConfigurationDetailResponse>(`/api/admin/configuration/${key}`);
    return data;
  },

  createParam: async (payload: ConfigurationCreate): Promise<ConfigurationResponse> => {
    const { data } = await apiClient.post<ConfigurationResponse>('/api/admin/configuration/', payload);
    return data;
  },

  deleteParam: async (key: string): Promise<{ message: string; key: string }> => {
    const { data } = await apiClient.delete<{ message: string; key: string }>(`/api/admin/configuration/${key}`);
    return data;
  },

  getHistory: async (key: string): Promise<ConfigurationHistoryResponse> => {
    const { data } = await apiClient.get<ConfigurationHistoryResponse>(`/api/admin/configuration/${key}/history`);
    return data;
  },

  createChangeRequest: async (payload: ConfigurationChangeCreate): Promise<ConfigurationChangeResponse> => {
    const { data } = await apiClient.post<ConfigurationChangeResponse>(
      '/api/admin/configuration/change-request',
      payload
    );
    return data;
  },

  listChangeRequests: async (): Promise<ConfigurationChangeResponse[]> => {
    const { data } = await apiClient.get<ConfigurationChangeResponse[]>(
      '/api/admin/configuration/change-requests'
    );
    return data;
  },

  getChangeRequest: async (changeId: number): Promise<ConfigurationChangeResponse> => {
    const { data } = await apiClient.get<ConfigurationChangeResponse>(
      `/api/admin/configuration/change-requests/${changeId}`
    );
    return data;
  },

  approveChangeRequest: async (changeId: number, comment?: string): Promise<ConfigurationChangeResponse> => {
    const { data } = await apiClient.post<ConfigurationChangeResponse>(
      `/api/admin/configuration/change-requests/${changeId}/approve`,
      { comment }
    );
    return data;
  },

  rejectChangeRequest: async (changeId: number, comment: string): Promise<ConfigurationChangeResponse> => {
    const { data } = await apiClient.post<ConfigurationChangeResponse>(
      `/api/admin/configuration/change-requests/${changeId}/reject`,
      { comment }
    );
    return data;
  },

  rollback: async (configurationId: number, payload: ConfigurationRollbackCreate): Promise<ConfigurationChangeResponse> => {
    const { data } = await apiClient.post<ConfigurationChangeResponse>(
      `/api/admin/configuration/${configurationId}/rollback`,
      payload
    );
    return data;
  },

  listAuditLogs: async (): Promise<ConfigurationAuditResponse[]> => {
    const { data } = await apiClient.get<ConfigurationAuditResponse[]>(
      '/api/admin/configuration/audit'
    );
    return data;
  },
};

// ----------------------------------------------------
// WhatsApp Templates (Full Admin CRUD)
// ----------------------------------------------------
export const whatsappApi = {
  list: async (): Promise<WhatsAppTemplateResponse[]> => {
    const { data } = await apiClient.get<WhatsAppTemplateResponse[]>('/api/admin/whatsapp/templates');
    return data;
  },

  getById: async (templateId: number): Promise<WhatsAppTemplateResponse> => {
    const { data } = await apiClient.get<WhatsAppTemplateResponse>(
      `/api/admin/whatsapp/templates/${templateId}`
    );
    return data;
  },

  create: async (payload: WhatsAppTemplateCreate): Promise<WhatsAppTemplateResponse> => {
    const { data } = await apiClient.post<WhatsAppTemplateResponse>(
      '/api/admin/whatsapp/templates',
      payload
    );
    return data;
  },

  update: async (templateId: number, payload: WhatsAppTemplateUpdate): Promise<WhatsAppTemplateResponse> => {
    const { data } = await apiClient.patch<WhatsAppTemplateResponse>(
      `/api/admin/whatsapp/templates/${templateId}`,
      payload
    );
    return data;
  },

  activate: async (templateId: number): Promise<WhatsAppTemplateResponse> => {
    const { data } = await apiClient.post<WhatsAppTemplateResponse>(
      `/api/admin/whatsapp/templates/${templateId}/activate`
    );
    return data;
  },

  deactivate: async (templateId: number): Promise<WhatsAppTemplateResponse> => {
    const { data } = await apiClient.post<WhatsAppTemplateResponse>(
      `/api/admin/whatsapp/templates/${templateId}/deactivate`
    );
    return data;
  },

  delete: async (templateId: number): Promise<{ message: string; template_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; template_id: number }>(`/api/admin/whatsapp/templates/${templateId}`);
    return data;
  },
};

// ----------------------------------------------------
// Fleet: Drivers & Vehicles (Full Admin CRUD)
// ----------------------------------------------------
export const fleetApi = {
  listActiveAssignments: async (): Promise<DriverVehicleAssignmentResponse[]> => {
    const { data } = await apiClient.get<DriverVehicleAssignmentResponse[]>(
      '/api/admin/driver-vehicle/active'
    );
    return data;
  },

  listDrivers: async (skip = 0, limit = 50): Promise<DriverResponse[]> => {
    const { data } = await apiClient.get<DriverResponse[]>('/api/admin/drivers/', {
      params: { skip, limit },
    });
    return data;
  },

  getDriver: async (driverId: number): Promise<DriverResponse> => {
    const { data } = await apiClient.get<DriverResponse>(`/api/admin/drivers/${driverId}`);
    return data;
  },

  createDriver: async (payload: DriverCreate): Promise<DriverResponse> => {
    const { data } = await apiClient.post<DriverResponse>('/api/admin/drivers/', payload);
    return data;
  },

  updateDriver: async (driverId: number, payload: DriverUpdate): Promise<DriverResponse> => {
    const { data } = await apiClient.patch<DriverResponse>(`/api/admin/drivers/${driverId}`, payload);
    return data;
  },

  deleteDriver: async (driverId: number): Promise<{ message: string; driver_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; driver_id: number }>(`/api/admin/drivers/${driverId}`);
    return data;
  },

  onboardDriver: async (payload: DriverOnboardRequest): Promise<DriverOnboardResponse> => {
    const { data } = await apiClient.post<DriverOnboardResponse>('/api/admin/drivers/onboard', payload);
    return data;
  },

  listVehicles: async (skip = 0, limit = 50): Promise<VehicleResponse[]> => {
    const { data } = await apiClient.get<VehicleResponse[]>('/api/admin/vehicles/', {
      params: { skip, limit },
    });
    return data;
  },

  getVehicle: async (vehicleId: number): Promise<VehicleResponse> => {
    const { data } = await apiClient.get<VehicleResponse>(`/api/admin/vehicles/${vehicleId}`);
    return data;
  },

  createVehicle: async (payload: VehicleCreate): Promise<VehicleResponse> => {
    const { data } = await apiClient.post<VehicleResponse>('/api/admin/vehicles/', payload);
    return data;
  },

  updateVehicle: async (vehicleId: number, payload: VehicleUpdate): Promise<VehicleResponse> => {
    const { data } = await apiClient.patch<VehicleResponse>(`/api/admin/vehicles/${vehicleId}`, payload);
    return data;
  },

  deleteVehicle: async (vehicleId: number): Promise<{ message: string; vehicle_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; vehicle_id: number }>(`/api/admin/vehicles/${vehicleId}`);
    return data;
  },

  assignVehicle: async (
    payload: DriverVehicleAssignmentCreate
  ): Promise<DriverVehicleAssignmentResponse> => {
    const { data } = await apiClient.post<DriverVehicleAssignmentResponse>(
      '/api/admin/driver-vehicle/assign',
      payload
    );
    return data;
  },

  unassignVehicle: async (driverId: number): Promise<DriverVehicleAssignmentResponse> => {
    const { data } = await apiClient.post<DriverVehicleAssignmentResponse>(
      `/api/admin/driver-vehicle/drivers/${driverId}/unassign`
    );
    return data;
  },
};

// ----------------------------------------------------
// Invoices & Payments (Full Admin CRUD)
// ----------------------------------------------------
export const invoicesApi = {
  list: async (params?: { customer_id?: number; status?: string; limit?: number; offset?: number }): Promise<InvoiceResponse[]> => {
    const { data } = await apiClient.get<InvoiceResponse[]>('/api/admin/invoices/', { params });
    return data;
  },

  getById: async (invoiceId: string): Promise<InvoiceResponse> => {
    const { data } = await apiClient.get<InvoiceResponse>(`/api/admin/invoices/${invoiceId}`);
    return data;
  },

  create: async (payload: InvoiceCreate): Promise<InvoiceResponse> => {
    const { data } = await apiClient.post<InvoiceResponse>('/api/admin/invoices/', payload);
    return data;
  },

  update: async (invoiceId: string, payload: InvoiceUpdate): Promise<InvoiceResponse> => {
    const { data } = await apiClient.patch<InvoiceResponse>(`/api/admin/invoices/${invoiceId}`, payload);
    return data;
  },

  delete: async (invoiceId: string): Promise<{ message: string; invoice_id: string }> => {
    const { data } = await apiClient.delete<{ message: string; invoice_id: string }>(`/api/admin/invoices/${invoiceId}`);
    return data;
  },

  recordPayment: async (payload: PaymentCreate, idempotencyKey?: string): Promise<PaymentResponse> => {
    const { data } = await apiClient.post<PaymentResponse>('/api/admin/payments/', payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
    return data;
  },

  deletePayment: async (paymentId: number): Promise<{ message: string; payment_id: number }> => {
    const { data } = await apiClient.delete<{ message: string; payment_id: number }>(`/api/admin/payments/${paymentId}`);
    return data;
  },

  getPayments: async (invoiceId: string): Promise<PaymentResponse[]> => {
    const { data } = await apiClient.get<PaymentResponse[]>(`/api/admin/payments/invoice/${invoiceId}`);
    return data;
  },
};

// ----------------------------------------------------
// Notifications Feed
// ----------------------------------------------------
export const notificationsApi = {
  list: async (): Promise<NotificationResponse[]> => {
    const { data } = await apiClient.get<NotificationResponse[]>('/api/notifications/');
    return data;
  },

  markRead: async (notificationId: number): Promise<NotificationResponse> => {
    const { data } = await apiClient.post<NotificationResponse>(`/api/notifications/${notificationId}/read`);
    return data;
  },
};
