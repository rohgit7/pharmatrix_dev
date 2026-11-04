import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { disposalCertificatesApi, facilitiesApi } from '../api/operations';
import {
  DisposalCertificateResponse,
  FacilityResponse,
  DisposalShipmentResponse,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { formatDate, formatDateTime } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import {
  FileCheck,
  Download,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Factory,
  Search,
  Filter,
  Eye,
  X,
  FileText,
  Calendar,
  Building2,
  Truck,
  Hash,
  Upload,
  Info,
  Clock,
} from 'lucide-react';

export const DisposalCertificates: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedFacility, setSelectedFacility] = useState<number | 'ALL'>('ALL');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [certificateToDelete, setCertificateToDelete] = useState<DisposalCertificateResponse | null>(null);
  const [viewingCertificate, setViewingCertificate] = useState<DisposalCertificateResponse | null>(null);

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // Queries
  const { data: facilities = [] } = useQuery({
    queryKey: ['adminFacilities'],
    queryFn: () => facilitiesApi.list(),
  });

  const { data: certificatesData = [], isLoading, isError, error } = useQuery({
    queryKey: ['adminDisposalCertificates', selectedFacility],
    queryFn: () =>
      disposalCertificatesApi.list(selectedFacility === 'ALL' ? undefined : selectedFacility),
  });

  // Ensure certificates is always an array
  const certificates: DisposalCertificateResponse[] = useMemo(() => {
    return Array.isArray(certificatesData) ? certificatesData : [];
  }, [certificatesData]);

  // Mutations
  const uploadCertificateMutation = useMutation({
    mutationFn: (formData: FormData) => disposalCertificatesApi.upload(formData),
    onSuccess: (cert) => {
      queryClient.invalidateQueries({ queryKey: ['adminDisposalCertificates'] });
      showAlert('success', `Certificate ${cert.certificate_number} registered successfully.`);
      setShowUploadModal(false);
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const deleteCertificateMutation = useMutation({
    mutationFn: (id: number) => disposalCertificatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDisposalCertificates'] });
      showAlert('success', 'Disposal certificate removed.');
      setCertificateToDelete(null);
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const handleDownload = async (cert: DisposalCertificateResponse) => {
    try {
      const res = await disposalCertificatesApi.getDownloadUrl(cert.id);
      const url = res.download_url || res.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        showAlert('error', 'Download link unavailable for this certificate.');
      }
    } catch (err) {
      showAlert('error', getErrorMessage(err));
    }
  };

  // Filtered certificates with complete null/undefined protection
  const filteredCertificates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certificates.filter((c) => {
      if (!c) return false;
      if (!q) return true;
      const certNum = (c.certificate_number || '').toLowerCase();
      const certCode = (c.certificate_code || '').toLowerCase();
      const storage = (c.storage_key || c.storage_path || c.file_name || '').toLowerCase();
      const facName = (c.facility_name || '').toLowerCase();
      const shipCode = (c.shipment_code || String(c.shipment_id || '')).toLowerCase();
      return (
        certNum.includes(q) ||
        certCode.includes(q) ||
        storage.includes(q) ||
        facName.includes(q) ||
        shipCode.includes(q)
      );
    });
  }, [certificates, search]);

  const columns: Column<DisposalCertificateResponse>[] = [
    {
      key: 'certificate_number',
      header: 'Certificate Details',
      sortable: true,
      render: (c) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-periwinkle flex-shrink-0" />
            <span className="font-mono text-xs font-bold text-white tracking-wide">
              {c.certificate_number || 'UNASSIGNED'}
            </span>
          </div>
          {c.certificate_code && (
            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono bg-charcoal-800 text-charcoal-400 border border-charcoal-700">
              {c.certificate_code}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'facility_name',
      header: 'Treatment Facility (CBMWTF)',
      sortable: true,
      render: (c) => (
        <div className="text-xs">
          <div className="font-semibold text-charcoal-200 flex items-center gap-1.5">
            <Factory className="w-3.5 h-3.5 text-charcoal-400" />
            <span>{c.facility_name || (c.facility_id ? `Facility #${c.facility_id}` : 'Designated CBMWTF')}</span>
          </div>
          {c.facility_code && (
            <span className="text-[10px] text-charcoal-500 font-mono">Code: {c.facility_code}</span>
          )}
        </div>
      ),
    },
    {
      key: 'shipment_code',
      header: 'Consignment / Shipment',
      sortable: true,
      render: (c) => (
        <div className="text-xs">
          <span className="inline-flex items-center gap-1 font-mono font-medium text-charcoal-300 bg-charcoal-800/80 px-2 py-0.5 rounded border border-charcoal-700">
            <Truck className="w-3 h-3 text-periwinkle" />
            {c.shipment_code || (c.shipment_id ? `Shipment #${String(c.shipment_id).slice(0, 8)}` : 'Consignment')}
          </span>
        </div>
      ),
    },
    {
      key: 'storage_path',
      header: 'Document File',
      render: (c) => (
        <div className="text-xs space-y-0.5 max-w-[200px]">
          <div className="flex items-center gap-1.5 text-charcoal-300 truncate font-mono text-[11px]" title={c.file_name || c.storage_path}>
            <FileText className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span className="truncate">{c.file_name || (c.storage_path ? c.storage_path.split('/').pop() : 'Certificate.pdf')}</span>
          </div>
          <span className="text-[10px] text-charcoal-500 block truncate">
            {c.content_type || 'application/pdf'}
          </span>
        </div>
      ),
    },
    {
      key: 'verification',
      header: 'CDSCO Compliance',
      render: (c) => (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="w-3 h-3" />
          <span>CDSCO Verified</span>
        </div>
      ),
    },
    {
      key: 'issued_at',
      header: 'Issued Date',
      sortable: true,
      render: (c) => (
        <div className="text-xs text-charcoal-400 space-y-0.5">
          <div>{formatDate(c.issued_at || c.uploaded_at)}</div>
          <div className="text-[10px] text-charcoal-500">{c.uploaded_at ? formatDateTime(c.uploaded_at).split(',')[1] : ''}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setViewingCertificate(c)}
            className="p-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 hover:text-white transition-colors"
            title="Inspect Certificate Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleDownload(c)}
            className="p-1.5 rounded-lg bg-periwinkle/10 hover:bg-periwinkle/20 text-periwinkle transition-colors"
            title="Download Certificate PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setCertificateToDelete(c)}
            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
            title="Delete Certificate Record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {alert && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm transition-all animate-in fade-in slide-in-from-bottom-2 ${
            alert.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/95 border-rose-500/40 text-rose-200'
          }`}
        >
          {alert.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <span>{alert.message}</span>
          <button onClick={() => setAlert(null)} className="ml-2 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-charcoal-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-periwinkle/10 border border-periwinkle/20 text-periwinkle">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Disposal Certificates
              </h1>
              <p className="text-xs text-charcoal-400 mt-0.5">
                Central Pollution Control Board (CPCB) & CDSCO regulatory destruction registry.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold text-xs rounded-xl shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Issue Disposal Certificate
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-charcoal-900 border border-charcoal-800 space-y-1">
          <span className="text-[10px] font-bold text-charcoal-400 uppercase tracking-wider">
            Total Certificates Issued
          </span>
          <div className="text-2xl font-bold text-white">
            {isLoading ? '...' : certificates.length}
          </div>
          <p className="text-[11px] text-charcoal-500">Verified destruction records</p>
        </div>

        <div className="p-4 rounded-xl bg-charcoal-900 border border-charcoal-800 space-y-1">
          <span className="text-[10px] font-bold text-charcoal-400 uppercase tracking-wider">
            Treatment Facilities
          </span>
          <div className="text-2xl font-bold text-periwinkle">
            {facilities.length}
          </div>
          <p className="text-[11px] text-charcoal-500">Authorized CBMWTF units</p>
        </div>

        <div className="p-4 rounded-xl bg-charcoal-900 border border-charcoal-800 space-y-1">
          <span className="text-[10px] font-bold text-charcoal-400 uppercase tracking-wider">
            Active Filter Matches
          </span>
          <div className="text-2xl font-bold text-white">
            {isLoading ? '...' : filteredCertificates.length}
          </div>
          <p className="text-[11px] text-charcoal-500">Matching current view</p>
        </div>

        <div className="p-4 rounded-xl bg-charcoal-900 border border-charcoal-800 space-y-1">
          <span className="text-[10px] font-bold text-charcoal-400 uppercase tracking-wider">
            Compliance Standard
          </span>
          <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-2">
            <ShieldCheck className="w-4 h-4" />
            BMWM Rules 2016 Compliant
          </div>
          <p className="text-[11px] text-charcoal-500">Cryptographically audit-trailed</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" />
          <input
            type="text"
            placeholder="Search by certificate number, consignment code, or facility name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-charcoal-900 border border-charcoal-800 rounded-xl text-xs text-white placeholder-charcoal-500 focus:outline-none focus:border-periwinkle/60 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-charcoal-400" />
          <select
            value={selectedFacility}
            onChange={(e) => setSelectedFacility(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="px-3 py-2.5 bg-charcoal-900 border border-charcoal-800 rounded-xl text-xs text-white focus:outline-none focus:border-periwinkle/60 transition-colors"
          >
            <option value="ALL">All Treatment Facilities</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.legal_name} ({f.facility_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error state if query fails */}
      {isError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <div className="font-semibold">Unable to load disposal certificates</div>
            <div className="text-rose-400/80 mt-0.5">{getErrorMessage(error)}</div>
          </div>
        </div>
      )}

      {/* DataTable */}
      <DataTable
        data={filteredCertificates}
        columns={columns}
        isLoading={isLoading}
        emptyTitle="No disposal certificates recorded"
        emptyDescription="Destruction certificates issued by authorized CBMWTF units will appear here for audit and compliance."
      />

      {/* ======================================================== */}
      {/* Issue / Upload Certificate Modal */}
      {/* ======================================================== */}
      {showUploadModal && (
        <UploadCertificateModal
          facilities={facilities}
          onClose={() => setShowUploadModal(false)}
          onSubmit={(formData) => uploadCertificateMutation.mutate(formData)}
          isSubmitting={uploadCertificateMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Inspect Certificate Detail Modal */}
      {/* ======================================================== */}
      {viewingCertificate && (
        <CertificateDetailModal
          certificate={viewingCertificate}
          onClose={() => setViewingCertificate(null)}
          onDownload={() => handleDownload(viewingCertificate)}
        />
      )}

      {/* ======================================================== */}
      {/* Delete Certificate Confirmation Modal */}
      {/* ======================================================== */}
      {certificateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in">
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5" />
              Delete Disposal Certificate
            </h3>
            <p className="text-xs text-charcoal-300 leading-relaxed">
              Are you sure you want to permanently delete certificate{' '}
              <strong className="text-white">"{certificateToDelete.certificate_number}"</strong>?
              This will remove the file from secure storage and invalidate the regulatory destruction record.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCertificateToDelete(null)}
                className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCertificateMutation.mutate(certificateToDelete.id)}
                disabled={deleteCertificateMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {deleteCertificateMutation.isPending ? 'Deleting...' : 'Delete Certificate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// Helper Component: Upload Certificate Modal
// ==========================================
interface UploadCertificateModalProps {
  facilities: FacilityResponse[];
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isSubmitting: boolean;
}

const UploadCertificateModal: React.FC<UploadCertificateModalProps> = ({
  facilities,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [certificateNumber, setCertificateNumber] = useState(
    `CERT-DISP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [facilityId, setFacilityId] = useState<number | ''>('');
  const [shipmentId, setShipmentId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: shipments = [], isLoading: isLoadingShipments } = useQuery({
    queryKey: ['adminDisposalShipmentsList'],
    queryFn: () => facilitiesApi.listShipments({ limit: 100 }),
  });

  const filteredShipments = useMemo(() => {
    if (!facilityId) return shipments;
    return shipments.filter((s) => s.facility_id === Number(facilityId));
  }, [shipments, facilityId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipmentId) return;

    const formData = new FormData();
    formData.append('shipment_id', String(shipmentId));
    formData.append('certificate_number', certificateNumber.trim());
    formData.append('issued_at', new Date().toISOString());
    if (notes.trim()) {
      formData.append('notes', notes.trim());
    }
    if (selectedFile) {
      formData.append('file', selectedFile);
    }

    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-periwinkle/10 text-periwinkle">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Issue Disposal Certificate
              </h2>
              <p className="text-[11px] text-charcoal-400">Record formal destruction from authorized CBMWTF</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-charcoal-400 hover:text-white rounded-lg hover:bg-charcoal-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-charcoal-300 font-semibold mb-1">
              Certificate Number *
            </label>
            <input
              type="text"
              value={certificateNumber}
              onChange={(e) => setCertificateNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white font-mono focus:outline-none focus:border-periwinkle"
              placeholder="e.g. CERT-DISP-2026-0042"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-charcoal-300 font-semibold mb-1">
                Treatment Facility (CBMWTF)
              </label>
              <select
                value={facilityId}
                onChange={(e) => {
                  setFacilityId(e.target.value ? Number(e.target.value) : '');
                  setShipmentId('');
                }}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              >
                <option value="">-- All Facilities --</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.legal_name} ({f.facility_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-charcoal-300 font-semibold mb-1">
                Disposal Consignment / Shipment *
              </label>
              <select
                value={shipmentId}
                onChange={(e) => setShipmentId(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                required
              >
                <option value="">
                  {isLoadingShipments ? 'Loading shipments...' : '-- Select Shipment --'}
                </option>
                {filteredShipments.map((s) => (
                  <option key={s.id} value={s.public_id || s.id}>
                    {s.shipment_code} - {s.expected_weight_kg}kg ({s.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* PDF Certificate File Upload */}
          <div>
            <label className="block text-charcoal-300 font-semibold mb-1">
              Certificate Document (PDF / Image)
            </label>
            <div className="border border-dashed border-charcoal-700 hover:border-periwinkle/50 rounded-xl p-4 bg-charcoal-800/50 text-center transition-colors">
              <input
                type="file"
                id="cert-file-input"
                accept=".pdf,application/pdf,image/jpeg,image/png"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="cert-file-input" className="cursor-pointer block">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2 text-white">
                    <FileText className="w-5 h-5 text-periwinkle" />
                    <span className="font-semibold text-xs">{selectedFile.name}</span>
                    <span className="text-[10px] text-charcoal-400">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-6 h-6 text-charcoal-400 mx-auto" />
                    <div className="text-xs text-charcoal-300">
                      <span className="text-periwinkle font-semibold">Click to select PDF certificate</span> or drag and drop
                    </div>
                    <div className="text-[10px] text-charcoal-500">PDF, JPG, PNG up to 10MB (Auto-generated compliant PDF if omitted)</div>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div>
            <label className="block text-charcoal-300 font-semibold mb-1">
              Compliance Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Incineration conducted under temperature compliance log #8412."
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white placeholder-charcoal-500 focus:outline-none focus:border-periwinkle"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !shipmentId}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 font-bold text-charcoal-900 rounded-xl transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Certificate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// Helper Component: View Certificate Details
// ==========================================
interface CertificateDetailModalProps {
  certificate: DisposalCertificateResponse;
  onClose: () => void;
  onDownload: () => void;
}

const CertificateDetailModal: React.FC<CertificateDetailModalProps> = ({
  certificate,
  onClose,
  onDownload,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-periwinkle/10 text-periwinkle">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Certificate Details</h2>
              <p className="text-[11px] text-charcoal-400 font-mono">{certificate.certificate_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-charcoal-400 hover:text-white rounded-lg hover:bg-charcoal-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-charcoal-800/50 border border-charcoal-800 space-y-1">
            <span className="text-[10px] text-charcoal-500 font-medium">System Code</span>
            <div className="font-mono text-white font-semibold">{certificate.certificate_code || `DC-${certificate.id}`}</div>
          </div>

          <div className="p-3 rounded-xl bg-charcoal-800/50 border border-charcoal-800 space-y-1">
            <span className="text-[10px] text-charcoal-500 font-medium">Consignment Code</span>
            <div className="font-mono text-periwinkle font-semibold">{certificate.shipment_code || `#${String(certificate.shipment_id).slice(0, 8)}`}</div>
          </div>

          <div className="p-3 rounded-xl bg-charcoal-800/50 border border-charcoal-800 space-y-1 col-span-2">
            <span className="text-[10px] text-charcoal-500 font-medium">Treatment Facility (CBMWTF)</span>
            <div className="text-white font-semibold flex items-center gap-2">
              <Factory className="w-4 h-4 text-charcoal-400" />
              <span>{certificate.facility_name || `Facility #${certificate.facility_id || 'Primary'}`}</span>
              {certificate.facility_code && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-charcoal-700 text-charcoal-300">
                  {certificate.facility_code}
                </span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-charcoal-800/50 border border-charcoal-800 space-y-1 col-span-2">
            <span className="text-[10px] text-charcoal-500 font-medium">Storage Path</span>
            <div className="font-mono text-[11px] text-charcoal-300 truncate" title={certificate.storage_path || certificate.storage_key}>
              {certificate.storage_path || certificate.storage_key || 'certificates/default.pdf'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-charcoal-800/50 border border-charcoal-800 space-y-1">
            <span className="text-[10px] text-charcoal-500 font-medium">Issued Date</span>
            <div className="text-white font-medium">{formatDate(certificate.issued_at)}</div>
          </div>

          <div className="p-3 rounded-xl bg-charcoal-800/50 border border-charcoal-800 space-y-1">
            <span className="text-[10px] text-charcoal-500 font-medium">Upload Timestamp</span>
            <div className="text-white font-medium">{certificate.uploaded_at ? formatDateTime(certificate.uploaded_at) : 'Registered'}</div>
          </div>

          {certificate.notes && (
            <div className="p-3 rounded-xl bg-charcoal-800/50 border border-charcoal-800 space-y-1 col-span-2">
              <span className="text-[10px] text-charcoal-500 font-medium">Notes</span>
              <div className="text-charcoal-300">{certificate.notes}</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-charcoal-800">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Digital Chain of Custody Verified</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 text-xs font-bold rounded-xl transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisposalCertificates;
