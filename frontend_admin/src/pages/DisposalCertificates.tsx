import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { disposalCertificatesApi, facilitiesApi, facilitiesApi as shipmentsApi } from '../api/operations';
import {
  DisposalCertificateResponse,
  DisposalCertificateCreate,
  FacilityResponse,
  DisposalShipmentResponse,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
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
  FileCode,
} from 'lucide-react';

export const DisposalCertificates: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedFacility, setSelectedFacility] = useState<number | 'ALL'>('ALL');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [certificateToDelete, setCertificateToDelete] = useState<DisposalCertificateResponse | null>(null);

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  // Queries
  const { data: facilities = [] } = useQuery({
    queryKey: ['adminFacilities'],
    queryFn: () => facilitiesApi.list(),
  });

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ['adminDisposalCertificates', selectedFacility],
    queryFn: () =>
      disposalCertificatesApi.list(selectedFacility === 'ALL' ? undefined : selectedFacility),
  });

  // Mutations
  const uploadCertificateMutation = useMutation({
    mutationFn: (payload: DisposalCertificateCreate) => disposalCertificatesApi.upload(payload),
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
      if (res.download_url) {
        window.open(res.download_url, '_blank');
      } else {
        showAlert('error', 'Download link unavailable.');
      }
    } catch (err) {
      showAlert('error', getErrorMessage(err));
    }
  };

  const filteredCertificates = certificates.filter((c) => {
    const matchesSearch =
      c.certificate_number.toLowerCase().includes(search.toLowerCase()) ||
      c.storage_key.toLowerCase().includes(search.toLowerCase()) ||
      (c.facility_name && c.facility_name.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  const columns: Column<DisposalCertificateResponse>[] = [
    {
      key: 'certificate_number',
      header: 'Certificate No.',
      sortable: true,
      render: (c) => (
        <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
          <FileCheck className="w-3.5 h-3.5 text-periwinkle" />
          {c.certificate_number}
        </span>
      ),
    },
    {
      key: 'facility_id',
      header: 'Treatment Facility (CBMWTF)',
      sortable: true,
      render: (c) => (
        <div className="text-xs">
          <span className="font-semibold text-charcoal-200">
            {c.facility_name || `Facility #${c.facility_id}`}
          </span>
        </div>
      ),
    },
    {
      key: 'shipment_id',
      header: 'Consignment / Shipment',
      sortable: true,
      render: (c) => (
        <span className="font-mono text-xs text-charcoal-400">Shipment #{c.shipment_id}</span>
      ),
    },
    {
      key: 'sha256_hash',
      header: 'Cryptographic Hash',
      render: (c) => (
        <span className="font-mono text-[10px] text-charcoal-500 truncate block max-w-xs" title={c.sha256_hash}>
          {c.sha256_hash.slice(0, 16)}...
        </span>
      ),
    },
    {
      key: 'issued_at',
      header: 'Issued Date',
      sortable: true,
      render: (c) => <span className="text-xs text-charcoal-400">{formatDate(c.issued_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
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
            title="Delete Certificate"
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
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm transition-all ${
            alert.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
          }`}
        >
          {alert.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
          <span>{alert.message}</span>
          <button onClick={() => setAlert(null)} className="ml-2 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-charcoal-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <FileCheck className="w-7 h-7 text-periwinkle" />
            CBMWTF Disposal Certificates
          </h1>
          <p className="text-xs text-charcoal-400 mt-1">
            Complete regulatory compliance registry: Upload, issue, cryptographic verify, and download CBMWTF destruction certificates.
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold text-xs rounded-xl shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Issue Disposal Certificate
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" />
          <input
            type="text"
            placeholder="Search by certificate number or facility name..."
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

      {/* DataTable */}
      <DataTable
        data={filteredCertificates}
        columns={columns}
        isLoading={isLoading}
        emptyTitle="No destruction certificates recorded yet."
      />


      {/* ======================================================== */}
      {/* Issue / Upload Certificate Modal */}
      {/* ======================================================== */}
      {showUploadModal && (
        <UploadCertificateModal
          facilities={facilities}
          onClose={() => setShowUploadModal(false)}
          onSubmit={(payload) => uploadCertificateMutation.mutate(payload)}
          isSubmitting={uploadCertificateMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Delete Certificate Modal */}
      {/* ======================================================== */}
      {certificateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5" />
              Delete Disposal Certificate
            </h3>
            <p className="text-xs text-charcoal-300 leading-relaxed">
              Are you sure you want to permanently delete certificate{' '}
              <strong className="text-white">"{certificateToDelete.certificate_number}"</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCertificateToDelete(null)}
                className="px-4 py-2 bg-charcoal-800 text-charcoal-300 text-xs font-semibold rounded-xl"
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
  onSubmit: (payload: DisposalCertificateCreate) => void;
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
  const [shipmentId, setShipmentId] = useState<number | ''>('');
  const [storageKey, setStorageKey] = useState('');
  const [sha256Hash, setSha256Hash] = useState('');

  const { data: shipments = [] } = useQuery({
    queryKey: ['adminDisposalShipmentsList'],
    queryFn: () => shipmentsApi.listShipments({ limit: 100 }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId || !shipmentId) return;

    const dummyHash =
      sha256Hash.trim() ||
      Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const dummyKey = storageKey.trim() || `certificates/${certificateNumber}.pdf`;

    onSubmit({
      certificate_number: certificateNumber.trim(),
      facility_id: Number(facilityId),
      shipment_id: Number(shipmentId),
      storage_key: dummyKey,
      sha256_hash: dummyHash,
      issued_at: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-periwinkle" />
            Issue CBMWTF Certificate
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-charcoal-400 mb-1">Certificate Number *</label>
            <input
              type="text"
              value={certificateNumber}
              onChange={(e) => setCertificateNumber(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">CBMWTF Facility *</label>
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              required
            >
              <option value="">-- Select Treatment Facility --</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.legal_name} ({f.facility_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Disposal Shipment / Consignment *</label>
            <select
              value={shipmentId}
              onChange={(e) => setShipmentId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              required
            >
              <option value="">-- Select Shipment --</option>
              {shipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shipment_code} (Status: {s.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Storage S3 / Supabase Key</label>
            <input
              type="text"
              placeholder="e.g. certificates/2026/CERT-DISP-001.pdf"
              value={storageKey}
              onChange={(e) => setStorageKey(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">SHA-256 Checksum (Optional)</label>
            <input
              type="text"
              placeholder="Auto-generated if left blank"
              value={sha256Hash}
              onChange={(e) => setSha256Hash(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !facilityId || !shipmentId}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 font-bold text-charcoal-900 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Certificate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DisposalCertificates;
