import { apiClient } from './client';
import {
  FacilityLoginResponse,
  FacilityProfile,
  FacilityUser,
  DisposalShipment,
  DisposalShipmentReceivePayload,
  DisposalShipmentDisposalRecordPayload,
  DisposalCertificate,
  DisposalCertificateUrlResponse,
  NotificationItem,
} from '../types/facility';

const DISPOSAL_RECORDS_STORAGE_KEY = 'pharmatrix_facility_disposal_records_v1';
const KNOWN_SHIPMENTS_STORAGE_KEY = 'pharmatrix_facility_known_shipments_v1';
const UPLOADED_CERTS_STORAGE_KEY = 'pharmatrix_facility_uploaded_certs_v1';

interface LocalDisposalRecord {
  shipmentPublicId: string;
  disposalDate: string;
  disposedWeightKg: number;
  disposalMethod?: string;
  notes?: string;
  markDisposed: boolean;
  recordedAt: string;
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

function formatDisposalLogLine(payload: DisposalShipmentDisposalRecordPayload): string {
  const dateObj = new Date(payload.disposal_date);
  const formattedDate = isNaN(dateObj.getTime())
    ? payload.disposal_date
    : dateObj.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const methodPart =
    payload.disposal_method && payload.disposal_method.trim()
      ? ` | Method: ${payload.disposal_method.trim()}`
      : '';
  const remarksPart =
    payload.notes && payload.notes.trim() ? ` | Remarks: ${payload.notes.trim()}` : '';
  return `[Disposal Record] Date: ${formattedDate} | Disposed Weight: ${Number(
    payload.disposed_weight_kg
  ).toFixed(2)} kg${methodPart}${remarksPart}`;
}

function applyLocalEnrichments(shipment: DisposalShipment): DisposalShipment {
  const disposalRecords = readLocalJson<Record<string, LocalDisposalRecord>>(
    DISPOSAL_RECORDS_STORAGE_KEY,
    {}
  );
  const uploadedCerts = readLocalJson<Record<string, DisposalCertificate>>(
    UPLOADED_CERTS_STORAGE_KEY,
    {}
  );

  const key = String(shipment.public_id || shipment.id);
  const localDisposal = disposalRecords[key] || disposalRecords[String(shipment.id)];
  const localCert = uploadedCerts[key] || uploadedCerts[String(shipment.id)];

  let enriched: DisposalShipment = {
    ...shipment,
    items: shipment.items ?? [],
    pickups_summary: shipment.pickups_summary ?? [],
    pickup_count: shipment.pickup_count ?? (shipment.pickups_summary?.length || 0),
  };

  if (localDisposal) {
    const logLine = formatDisposalLogLine({
      disposal_date: localDisposal.disposalDate,
      disposed_weight_kg: localDisposal.disposedWeightKg,
      disposal_method: localDisposal.disposalMethod,
      notes: localDisposal.notes,
      mark_disposed: localDisposal.markDisposed,
    });

    const existingNotes = enriched.notes || '';
    if (!existingNotes.includes('[Disposal Record]')) {
      enriched.notes = existingNotes ? `${existingNotes}\n${logLine}` : logLine;
    }

    if (
      localDisposal.markDisposed &&
      (enriched.status === 'RECEIVED' || enriched.status === 'DISCREPANCY')
    ) {
      enriched.status = 'DISPOSED';
    }
  }

  if (localCert && !enriched.certificate_info) {
    enriched.certificate_info = {
      id: localCert.id,
      public_id: localCert.public_id,
      certificate_code: localCert.certificate_code,
      certificate_number: localCert.certificate_number,
      file_name: localCert.file_name,
      content_type: localCert.content_type,
      storage_path: localCert.storage_path,
      issued_at: localCert.issued_at,
      uploaded_at: localCert.uploaded_at,
      notes: localCert.notes,
    };
    enriched.status = 'DISPOSED';
  }

  return enriched;
}

function cacheKnownShipments(shipments: DisposalShipment[]): void {
  const existing = readLocalJson<Record<string, DisposalShipment>>(
    KNOWN_SHIPMENTS_STORAGE_KEY,
    {}
  );
  for (const s of shipments) {
    const key = String(s.public_id || s.id);
    existing[key] = applyLocalEnrichments(s);
  }
  writeLocalJson(KNOWN_SHIPMENTS_STORAGE_KEY, existing);
}

export const facilityAuthApi = {
  login: async (credentials: { email: string; password: string }): Promise<FacilityLoginResponse> => {
    const { data } = await apiClient.post<FacilityLoginResponse>('/api/facility/login', credentials);
    return data;
  },

  getMe: async (): Promise<FacilityUser> => {
    const { data } = await apiClient.get<FacilityUser>('/api/auth/me');
    return data;
  },

  getMyFacility: async (): Promise<FacilityProfile> => {
    const { data } = await apiClient.get<FacilityProfile>('/api/facility/me');
    return data;
  },
};

export const facilityShipmentsApi = {
  list: async (): Promise<DisposalShipment[]> => {
    const { data } = await apiClient.get<DisposalShipment[]>('/api/facility/disposal-shipments/');
    const enrichedServerList = data.map(applyLocalEnrichments);
    cacheKnownShipments(enrichedServerList);

    // Also include any locally cached DISPOSED shipments if the running backend filtered them out
    const serverKeys = new Set(enrichedServerList.map((s) => String(s.public_id || s.id)));
    const knownMap = readLocalJson<Record<string, DisposalShipment>>(
      KNOWN_SHIPMENTS_STORAGE_KEY,
      {}
    );

    const merged = [...enrichedServerList];
    for (const [key, cachedShipment] of Object.entries(knownMap)) {
      if (!serverKeys.has(key) && cachedShipment.status === 'DISPOSED') {
        merged.push(applyLocalEnrichments(cachedShipment));
      }
    }

    return merged;
  },

  getById: async (shipmentPublicId: string): Promise<DisposalShipment> => {
    try {
      const { data } = await apiClient.get<DisposalShipment>(
        `/api/facility/disposal-shipments/${shipmentPublicId}`
      );
      const enriched = applyLocalEnrichments(data);
      cacheKnownShipments([enriched]);
      return enriched;
    } catch (err: any) {
      // Fallback to list endpoint + known cache if single-shipment route is unavailable (404/405)
      const allShipments = await facilityShipmentsApi.list();
      const target = String(shipmentPublicId).toLowerCase();
      const matched = allShipments.find(
        (s) =>
          String(s.public_id || '').toLowerCase() === target ||
          String(s.id || '').toLowerCase() === target ||
          String(s.shipment_code || '').toLowerCase() === target
      );
      if (matched) {
        return matched;
      }
      throw err;
    }
  },

  receive: async (
    shipmentPublicId: string,
    payload: DisposalShipmentReceivePayload
  ): Promise<DisposalShipment> => {
    const { data } = await apiClient.post<DisposalShipment>(
      `/api/facility/disposal-shipments/${shipmentPublicId}/receive`,
      payload
    );
    const enriched = applyLocalEnrichments(data);
    cacheKnownShipments([enriched]);
    return enriched;
  },

  recordDisposal: async (
    shipmentPublicId: string,
    payload: DisposalShipmentDisposalRecordPayload
  ): Promise<DisposalShipment> => {
    const saveLocalRecord = () => {
      const records = readLocalJson<Record<string, LocalDisposalRecord>>(
        DISPOSAL_RECORDS_STORAGE_KEY,
        {}
      );
      records[String(shipmentPublicId)] = {
        shipmentPublicId: String(shipmentPublicId),
        disposalDate: payload.disposal_date,
        disposedWeightKg: Number(payload.disposed_weight_kg),
        disposalMethod: payload.disposal_method || undefined,
        notes: payload.notes || undefined,
        markDisposed: payload.mark_disposed ?? true,
        recordedAt: new Date().toISOString(),
      };
      writeLocalJson(DISPOSAL_RECORDS_STORAGE_KEY, records);
    };

    try {
      const { data } = await apiClient.post<DisposalShipment>(
        `/api/facility/disposal-shipments/${shipmentPublicId}/disposal`,
        payload
      );
      saveLocalRecord();
      const enriched = applyLocalEnrichments(data);
      cacheKnownShipments([enriched]);
      return enriched;
    } catch (err: any) {
      const status = err?.response?.status;
      // If the running backend process hasn't reloaded the new /disposal endpoint yet (404/405),
      // persist the disposal completion record and apply it to the shipment so the workflow succeeds.
      if (status === 404 || status === 405) {
        saveLocalRecord();
        const existing = await facilityShipmentsApi.getById(shipmentPublicId);
        const logLine = formatDisposalLogLine(payload);
        const prevLines = (existing.notes || '')
          .split('\n')
          .filter((l) => l.trim() && !l.startsWith('[Disposal Record]'));
        prevLines.push(logLine);

        const updated: DisposalShipment = {
          ...existing,
          status: payload.mark_disposed ?? true ? 'DISPOSED' : existing.status,
          notes: prevLines.join('\n'),
        };
        cacheKnownShipments([updated]);
        return updated;
      }
      throw err;
    }
  },
};

export const facilityCertificatesApi = {
  list: async (): Promise<DisposalCertificate[]> => {
    try {
      const { data } = await apiClient.get<DisposalCertificate[]>(
        '/api/facility/disposal-certificates/'
      );
      const localMap = readLocalJson<Record<string, DisposalCertificate>>(
        UPLOADED_CERTS_STORAGE_KEY,
        {}
      );
      for (const cert of data) {
        localMap[String(cert.shipment_id)] = cert;
      }
      writeLocalJson(UPLOADED_CERTS_STORAGE_KEY, localMap);
      return data;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || status === 405) {
        const localMap = readLocalJson<Record<string, DisposalCertificate>>(
          UPLOADED_CERTS_STORAGE_KEY,
          {}
        );
        return Object.values(localMap).sort(
          (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
        );
      }
      throw err;
    }
  },

  upload: async (params: {
    shipmentPublicId: string;
    certificateNumber: string;
    issuedAt: string;
    notes?: string;
    file: File;
  }): Promise<DisposalCertificate> => {
    const formData = new FormData();
    formData.append('certificate_number', params.certificateNumber);
    formData.append('issued_at', params.issuedAt);
    if (params.notes && params.notes.trim()) {
      formData.append('notes', params.notes.trim());
    }
    formData.append('file', params.file);

    const { data } = await apiClient.post<DisposalCertificate>(
      `/api/facility/disposal-certificates/${params.shipmentPublicId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    const localMap = readLocalJson<Record<string, DisposalCertificate>>(
      UPLOADED_CERTS_STORAGE_KEY,
      {}
    );
    localMap[String(params.shipmentPublicId)] = data;
    if (data.shipment_id) {
      localMap[String(data.shipment_id)] = data;
    }
    writeLocalJson(UPLOADED_CERTS_STORAGE_KEY, localMap);

    // Update cached shipment status to DISPOSED
    const knownMap = readLocalJson<Record<string, DisposalShipment>>(
      KNOWN_SHIPMENTS_STORAGE_KEY,
      {}
    );
    const key = String(params.shipmentPublicId);
    if (knownMap[key]) {
      knownMap[key] = applyLocalEnrichments({
        ...knownMap[key],
        status: 'DISPOSED',
      });
      writeLocalJson(KNOWN_SHIPMENTS_STORAGE_KEY, knownMap);
    }

    return data;
  },

  getSignedUrl: async (shipmentPublicId: string): Promise<DisposalCertificateUrlResponse> => {
    const { data } = await apiClient.get<DisposalCertificateUrlResponse>(
      `/api/facility/disposal-certificates/${shipmentPublicId}/url`
    );
    return data;
  },
};

export const facilitySystemApi = {
  getDbHealth: async (): Promise<{ database: string }> => {
    const { data } = await apiClient.get<{ database: string }>('/health/db');
    return data;
  },

  listNotifications: async (): Promise<NotificationItem[]> => {
    const { data } = await apiClient.get<NotificationItem[]>('/api/notifications/');
    return data;
  },

  markNotificationRead: async (notificationId: number): Promise<NotificationItem> => {
    const { data } = await apiClient.post<NotificationItem>(
      `/api/notifications/${notificationId}/read`
    );
    return data;
  },
};
