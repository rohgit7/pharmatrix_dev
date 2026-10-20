import { apiClient } from './client';
import { AdminDashboardSummary } from '../types/auth';
import {
  PickupAdminResponse,
  PickupStatus,
  RouteResponse,
  RouteStatus,
  RouteCreate,
  OptimizeRoutesResponse,
  WarehouseResponse,
  WarehouseCreate,
  WarehouseUpdate,
  WarehouseIntakeResponse,
  WarehouseReceiveRequest,
  WarehouseClassifyRequest,
  FacilityResponse,
  FacilityCreate,
  FacilityUpdate,
  DisposalShipmentCreate,
  DisposalShipmentResponse,
  OperationalExceptionResponse,
  OperationalExceptionStatus,
  OperationalExceptionType,
  CustomerDocumentResponse,
  ConfigurationResponse,
  ConfigurationDetailResponse,
  ConfigurationHistoryResponse,
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
  InvoiceResponse,
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
// Pickups
// ----------------------------------------------------
export const pickupsApi = {
  list: async (status?: PickupStatus): Promise<PickupAdminResponse[]> => {
    const { data } = await apiClient.get<PickupAdminResponse[]>('/api/admin/pickups/', {
      params: status ? { status } : undefined,
    });
    return data;
  },

  getById: async (pickupId: string): Promise<PickupAdminResponse> => {
    const { data } = await apiClient.get<PickupAdminResponse>(`/api/admin/pickups/${pickupId}`);
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
};

// ----------------------------------------------------
// Routes & Optimization
// ----------------------------------------------------
export const routesApi = {
  list: async (status?: RouteStatus): Promise<RouteResponse[]> => {
    const { data } = await apiClient.get<RouteResponse[]>('/api/admin/routes/', {
      params: status ? { status } : undefined,
    });
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

  optimize: async (payload: { warehouse_id: number; route_date: string }): Promise<OptimizeRoutesResponse> => {
    const { data } = await apiClient.post<OptimizeRoutesResponse>('/api/admin/routes/optimize', payload);
    return data;
  },

  getProofUrl: async (stopId: number): Promise<{ stop_id: number; proof_uploaded: boolean; signed_url: string; expires_in: number }> => {
    const { data } = await apiClient.get(`/api/admin/collection-proofs/${stopId}/url`);
    return data;
  },
};

// ----------------------------------------------------
// Warehouses & Intakes
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

  getIntake: async (intakeId: number): Promise<WarehouseIntakeResponse> => {
    const { data } = await apiClient.get<WarehouseIntakeResponse>(`/api/admin/warehouse-intakes/${intakeId}`);
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
// Facilities & Shipments
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

  createShipment: async (payload: DisposalShipmentCreate): Promise<DisposalShipmentResponse> => {
    const { data } = await apiClient.post<DisposalShipmentResponse>('/api/admin/disposal-shipments/', payload);
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
// Exceptions
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

  resolve: async (id: number, resolutionNotes: string): Promise<OperationalExceptionResponse> => {
    const { data } = await apiClient.post<OperationalExceptionResponse>(`/api/admin/exceptions/${id}/resolve`, {
      resolution_notes: resolutionNotes,
    });
    return data;
  },
};

// ----------------------------------------------------
// Customer Documents
// ----------------------------------------------------
export const customerDocumentsApi = {
  list: async (): Promise<CustomerDocumentResponse[]> => {
    const { data } = await apiClient.get<CustomerDocumentResponse[]>('/api/admin/customer-documents/');
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
};

// ----------------------------------------------------
// Runtime Configuration & Audit
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
// WhatsApp Templates
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
};

// ----------------------------------------------------
// Fleet: Drivers & Vehicles
// ----------------------------------------------------
export const fleetApi = {
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
};

// ----------------------------------------------------
// Invoices & Payments
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

  recordPayment: async (payload: PaymentCreate, idempotencyKey?: string): Promise<PaymentResponse> => {
    const { data } = await apiClient.post<PaymentResponse>('/api/admin/payments/', payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
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
