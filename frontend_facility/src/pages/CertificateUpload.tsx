import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FileCheck,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { facilityShipmentsApi, facilityCertificatesApi } from '../api/facility';
import { DisposalCertificate } from '../types/facility';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { ErrorState } from '../components/common/ErrorState';
import { formatDate, formatDateTime, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export const CertificateUpload: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedId = searchParams.get('shipmentId') || '';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(preselectedId);
  const [certificateNumber, setCertificateNumber] = useState<string>(
    () => `CERT-CBMWTF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [issuedAt, setIssuedAt] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [downloadingShipmentId, setDownloadingShipmentId] = useState<string | null>(null);

  const { data: shipments = [], isLoading: shipmentsLoading } = useQuery({
    queryKey: ['facilityShipments'],
    queryFn: facilityShipmentsApi.list,
  });

  const {
    data: certificates = [],
    isLoading: certsLoading,
    isError: certsError,
    error: certsErrObj,
    refetch: refetchCerts,
  } = useQuery({
    queryKey: ['facilityCertificates'],
    queryFn: facilityCertificatesApi.list,
  });

  const certifiedShipmentIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of certificates) {
      set.add(c.shipment_id);
    }
    for (const s of shipments) {
      if (s.certificate_info) {
        set.add(s.public_id);
      }
    }
    return set;
  }, [certificates, shipments]);

  // Shipments eligible for certificate upload: RECEIVED, DISCREPANCY, or DISPOSED without an existing certificate
  const eligibleShipments = useMemo(
    () =>
      shipments.filter(
        (s) =>
          ['RECEIVED', 'DISCREPANCY', 'DISPOSED'].includes(s.status) &&
          !certifiedShipmentIds.has(s.public_id)
      ),
    [shipments, certifiedShipmentIds]
  );

  useEffect(() => {
    if (preselectedId) {
      setSelectedShipmentId(preselectedId);
    } else if (!selectedShipmentId && eligibleShipments.length > 0) {
      setSelectedShipmentId(eligibleShipments[0].public_id);
    }
  }, [preselectedId, eligibleShipments, selectedShipmentId]);

  const shipmentByPublicId = useMemo(() => {
    const map = new Map<string, (typeof shipments)[number]>();
    for (const s of shipments) {
      map.set(s.public_id, s);
    }
    return map;
  }, [shipments]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatusMessage(null);
    setUploadStatus('idle');
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadStatus('error');
      setStatusMessage(
        `Invalid file type (${file.type || 'unknown'}). Only PDF, JPG, and PNG files are allowed.`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadStatus('error');
      setStatusMessage('Certificate file size cannot exceed 10 MB.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const uploadMutation = useMutation({
    mutationFn: (params: {
      shipmentPublicId: string;
      certificateNumber: string;
      issuedAt: string;
      notes?: string;
      file: File;
    }) => facilityCertificatesApi.upload(params),
    onMutate: () => {
      setUploadStatus('uploading');
      setStatusMessage('Uploading certificate to secure compliance storage...');
    },
    onSuccess: (cert) => {
      setUploadStatus('success');
      setStatusMessage(
        `Certificate ${cert.certificate_number} (${cert.file_name}) uploaded and linked to shipment. Status updated to DISPOSED.`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setNotes('');
      setCertificateNumber(
        `CERT-CBMWTF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      );
      setSearchParams({});
      queryClient.invalidateQueries({ queryKey: ['facilityCertificates'] });
      queryClient.invalidateQueries({ queryKey: ['facilityShipments'] });
    },
    onError: (err) => {
      setUploadStatus('error');
      setStatusMessage(getErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedShipmentId) {
      setUploadStatus('error');
      setStatusMessage('Please select a received shipment to associate with this certificate.');
      return;
    }

    if (!certificateNumber.trim()) {
      setUploadStatus('error');
      setStatusMessage('Please enter a valid certificate number.');
      return;
    }

    if (!issuedAt) {
      setUploadStatus('error');
      setStatusMessage('Please provide the certificate issue date.');
      return;
    }

    if (!selectedFile) {
      setUploadStatus('error');
      setStatusMessage('Please choose a PDF, JPG, or PNG certificate file to upload.');
      return;
    }

    uploadMutation.mutate({
      shipmentPublicId: selectedShipmentId,
      certificateNumber: certificateNumber.trim(),
      issuedAt: new Date(issuedAt).toISOString(),
      notes: notes.trim() || undefined,
      file: selectedFile,
    });
  };

  const handleViewDownload = async (shipmentPublicId: string) => {
    setDownloadingShipmentId(shipmentPublicId);
    try {
      const res = await facilityCertificatesApi.getSignedUrl(shipmentPublicId);
      if (res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setUploadStatus('error');
      setStatusMessage(getErrorMessage(err));
    } finally {
      setDownloadingShipmentId(null);
    }
  };

  const columns: Column<DisposalCertificate>[] = [
    {
      key: 'certificate_number',
      header: 'Certificate Number',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-mono text-xs font-bold text-charcoal-900 block">
            {row.certificate_number}
          </span>
          <span className="font-mono text-[10px] text-charcoal-400">
            Code: {row.certificate_code}
          </span>
        </div>
      ),
    },
    {
      key: 'shipment_id',
      header: 'Associated Shipment',
      sortable: true,
      render: (row) => {
        const sh = shipmentByPublicId.get(row.shipment_id);
        return (
          <div>
            <Link
              to={`/shipments/${row.shipment_id}`}
              className="font-mono text-xs font-bold text-periwinkle-700 hover:underline block"
            >
              {sh ? sh.shipment_code : `${row.shipment_id.slice(0, 8)}...`}
            </Link>
            {sh && (
              <span className="text-[11px] text-charcoal-500">
                {formatWeight(sh.received_weight_kg ?? sh.expected_weight_kg)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'file_name',
      header: 'Uploaded Filename',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-periwinkle-700 flex-shrink-0" />
          <div>
            <span className="text-xs font-semibold text-charcoal-800 block">{row.file_name}</span>
            <span className="text-[10px] text-charcoal-400 uppercase">{row.content_type}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'issued_at',
      header: 'Issued Date',
      sortable: true,
      render: (row) => <span className="text-xs text-charcoal-700">{formatDate(row.issued_at)}</span>,
    },
    {
      key: 'uploaded_at',
      header: 'Uploaded At',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-charcoal-500">{formatDateTime(row.uploaded_at)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Upload Status',
      render: () => <StatusBadge status="UPLOADED" customLabel="Persisted & Verified" />,
    },
    {
      key: 'actions',
      header: 'Action',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/shipments/${row.shipment_id}`}
            className="px-2.5 py-1.5 rounded-lg border border-ivory-300 bg-white hover:bg-ivory-100 text-xs font-semibold text-charcoal-700 inline-flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Shipment</span>
          </Link>
          <button
            onClick={() => handleViewDownload(row.shipment_id)}
            disabled={downloadingShipmentId === row.shipment_id}
            className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {downloadingShipmentId === row.shipment_id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>View / Download</span>
          </button>
        </div>
      ),
    },
  ];

  if (certsError) {
    return (
      <ErrorState
        title="Unable to load disposal certificates"
        message={getErrorMessage(certsErrObj)}
        onRetry={() => refetchCerts()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-periwinkle-700" />
            <h1 className="text-xl font-bold text-charcoal-900 tracking-tight">
              Disposal Certificate Upload &amp; Registry
            </h1>
          </div>
          <p className="text-xs text-charcoal-500 mt-1">
            Upload official PDF/image destruction certificates for received waste consignments and
            view or download issued certificates.
          </p>
        </div>
      </div>

      {/* Upload Status Banner (with Retry button if failed) */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-medium ${
            uploadStatus === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : uploadStatus === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-periwinkle-50 border-periwinkle-200 text-periwinkle-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {uploadStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : uploadStatus === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin text-periwinkle-700 flex-shrink-0" />
            )}
            <span>{statusMessage}</span>
          </div>

          <div className="flex items-center gap-2">
            {uploadStatus === 'error' && selectedFile && selectedShipmentId && (
              <button
                type="button"
                onClick={() =>
                  uploadMutation.mutate({
                    shipmentPublicId: selectedShipmentId,
                    certificateNumber: certificateNumber.trim(),
                    issuedAt: new Date(issuedAt).toISOString(),
                    notes: notes.trim() || undefined,
                    file: selectedFile,
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Upload</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setStatusMessage(null);
                setUploadStatus('idle');
              }}
              className="text-charcoal-500 hover:text-charcoal-800 font-semibold px-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Certificate Upload Form Card */}
      <section className="bg-white p-6 rounded-xl border border-ivory-300 shadow-subtle space-y-5">
        <div className="border-b border-ivory-200 pb-3">
          <h2 className="text-sm font-bold text-charcoal-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-periwinkle-700" />
            <span>Issue &amp; Upload New Disposal Certificate</span>
          </h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Supported formats: PDF, JPG, PNG (Max size: 10 MB). Uploading a certificate finalizes
            the shipment lifecycle as DISPOSED.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Shipment Selector */}
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1.5">
                Associated Received Shipment *
              </label>
              <select
                required
                value={selectedShipmentId}
                onChange={(e) => setSelectedShipmentId(e.target.value)}
                disabled={shipmentsLoading || uploadMutation.isPending}
                className="w-full h-10 px-3 bg-ivory-50 border border-ivory-300 rounded-xl text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-periwinkle"
              >
                <option value="">-- Select eligible shipment --</option>
                {eligibleShipments.map((s) => (
                  <option key={s.public_id} value={s.public_id}>
                    {s.shipment_code} — Rec: {formatWeight(s.received_weight_kg ?? s.expected_weight_kg)} ({s.status})
                  </option>
                ))}
              </select>
              {eligibleShipments.length === 0 && !shipmentsLoading && (
                <p className="text-[11px] text-amber-700 mt-1">
                  All received shipments currently have certificates uploaded.
                </p>
              )}
            </div>

            {/* Certificate Number */}
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1.5">
                Official Certificate Number *
              </label>
              <input
                type="text"
                required
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                disabled={uploadMutation.isPending}
                placeholder="CERT-CBMWTF-2026-0001"
                className="w-full h-10 px-3 bg-ivory-50 border border-ivory-300 rounded-xl font-mono font-bold text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-periwinkle"
              />
            </div>

            {/* Issued Date */}
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1.5">
                Certificate Issue Date &amp; Time *
              </label>
              <input
                type="datetime-local"
                required
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                disabled={uploadMutation.isPending}
                className="w-full h-10 px-3 bg-ivory-50 border border-ivory-300 rounded-xl text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-periwinkle"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Picker */}
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1.5">
                Certificate Document File (PDF / JPG / PNG, max 10 MB) *
              </label>
              <div className="p-3.5 rounded-xl border border-dashed border-ivory-400 bg-ivory-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={handleFileChange}
                  disabled={uploadMutation.isPending}
                  className="text-xs text-charcoal-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-periwinkle file:text-charcoal-900 hover:file:bg-periwinkle-400 cursor-pointer"
                />
                {selectedFile && (
                  <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 truncate max-w-[200px]">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1.5">
                Certificate Notes / Compliance Reference (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={uploadMutation.isPending}
                placeholder="e.g., Certified destruction per BMWM Rules 2016..."
                className="w-full h-12 px-3.5 bg-ivory-50 border border-ivory-300 rounded-xl text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-periwinkle"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={
                uploadMutation.isPending || !selectedShipmentId || !selectedFile
              }
              className="px-5 py-2.5 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-periwinkle" />
                  <span>Uploading Certificate...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-periwinkle" />
                  <span>Upload &amp; Persist Disposal Certificate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Uploaded Certificates Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-charcoal-900">
            Uploaded Disposal Certificates ({certificates.length})
          </h2>
        </div>

        <DataTable
          columns={columns}
          data={certificates}
          isLoading={certsLoading}
          searchPlaceholder="Search by certificate number, code, filename, or shipment..."
          emptyTitle="No disposal certificates uploaded yet"
          emptyDescription="Uploaded disposal certificates for your facility will be listed here for viewing and download."
        />
      </section>
    </div>
  );
};

