import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Flame,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Scale,
  Eye,
  Calendar,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { facilityShipmentsApi } from '../api/facility';
import { DisposalShipment } from '../types/facility';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { Modal } from '../components/common/Modal';
import { formatDateTime, formatWeight, formatEnumLabel } from '../utils/formatters';
import { getErrorMessage } from '../api/client';

const DISPOSAL_METHODS = [
  'High-Temperature Incineration (Rotary Kiln)',
  'Autoclaving & Mechanical Shredding',
  'Chemical Disinfection & Encapsulation',
  'Plasma Pyrolysis',
  'Deep Burial / Secure Landfill (Ash & Inerts)',
];

export const DisposalManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedId = searchParams.get('shipmentId') || '';

  const [activeTab, setActiveTab] = useState<'PENDING' | 'COMPLETED'>('PENDING');
  const [selectedShipment, setSelectedShipment] = useState<DisposalShipment | null>(null);
  const [disposalDate, setDisposalDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [disposedWeight, setDisposedWeight] = useState<string>('');
  const [disposalMethod, setDisposalMethod] = useState<string>(DISPOSAL_METHODS[0]);
  const [disposalRemarks, setDisposalRemarks] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    shipmentPublicId?: string;
  } | null>(null);

  const {
    data: shipments = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['facilityShipments'],
    queryFn: facilityShipmentsApi.list,
    refetchInterval: 15000,
  });

  const pendingDisposalShipments = useMemo(
    () => shipments.filter((s) => s.status === 'RECEIVED' || s.status === 'DISCREPANCY'),
    [shipments]
  );

  const completedDisposalShipments = useMemo(
    () => shipments.filter((s) => s.status === 'DISPOSED'),
    [shipments]
  );

  const openDisposalModal = (shipment: DisposalShipment) => {
    setModalError(null);
    setSelectedShipment(shipment);
    setDisposalDate(new Date().toISOString().slice(0, 16));
    const defaultWeight = Number(
      shipment.received_weight_kg ?? shipment.expected_weight_kg ?? 0
    );
    setDisposedWeight(defaultWeight > 0 ? defaultWeight.toFixed(2) : '');
    setDisposalMethod(DISPOSAL_METHODS[0]);
    setDisposalRemarks('');
  };

  useEffect(() => {
    if (preselectedId && shipments.length > 0 && !selectedShipment) {
      const target = shipments.find(
        (s) =>
          String(s.public_id || '').toLowerCase() === preselectedId.toLowerCase() ||
          String(s.id || '').toLowerCase() === preselectedId.toLowerCase()
      );
      if (target && ['RECEIVED', 'DISCREPANCY', 'DISPOSED'].includes(target.status)) {
        openDisposalModal(target);
      }
    }
  }, [preselectedId, shipments]);

  const recordDisposalMutation = useMutation({
    mutationFn: (params: {
      shipmentPublicId: string;
      disposalDate: string;
      disposedWeightKg: number;
      disposalMethod: string;
      notes: string;
    }) => {
      const parsedDate = new Date(params.disposalDate);
      const isoDate = isNaN(parsedDate.getTime())
        ? new Date().toISOString()
        : parsedDate.toISOString();

      return facilityShipmentsApi.recordDisposal(params.shipmentPublicId, {
        disposal_date: isoDate,
        disposed_weight_kg: params.disposedWeightKg,
        disposal_method: params.disposalMethod,
        notes: params.notes,
        mark_disposed: true,
      });
    },
    onSuccess: (updated) => {
      const updatedKey = String(updated.public_id || updated.id);
      queryClient.setQueryData<DisposalShipment[]>(['facilityShipments'], (prev) => {
        if (!prev) return [updated];
        return prev.map((s) =>
          String(s.public_id || s.id) === updatedKey ? updated : s
        );
      });
      queryClient.invalidateQueries({ queryKey: ['facilityShipments'] });
      queryClient.invalidateQueries({
        queryKey: ['facilityShipmentDetail', updatedKey],
      });
      setModalError(null);
      setFeedback({
        type: 'success',
        message: `Disposal completion recorded for ${updated.shipment_code}. Status updated to DISPOSED.`,
        shipmentPublicId: updatedKey,
      });
      setSelectedShipment(null);
      setActiveTab('COMPLETED');
      setSearchParams({});
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      setModalError(msg);
      setFeedback({
        type: 'error',
        message: msg,
      });
    },
  });

  const handleDisposalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!selectedShipment) return;

    const parsedWeight = parseFloat(disposedWeight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      setModalError('Please enter a valid positive final disposed weight (kg).');
      return;
    }

    if (!disposalDate) {
      setModalError('Please provide the disposal completion date and time.');
      return;
    }

    const targetId = selectedShipment.public_id || String(selectedShipment.id);
    recordDisposalMutation.mutate({
      shipmentPublicId: targetId,
      disposalDate,
      disposedWeightKg: Number(parsedWeight.toFixed(2)),
      disposalMethod,
      notes: disposalRemarks.trim(),
    });
  };

  if (isError) {
    return (
      <ErrorState
        title="Unable to load disposal management queue"
        message={getErrorMessage(error)}
        onRetry={() => refetch()}
      />
    );
  }

  const displayedList =
    activeTab === 'PENDING' ? pendingDisposalShipments : completedDisposalShipments;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-600" />
            <h1 className="text-xl font-bold text-charcoal-900 tracking-tight">
              Disposal Operations Management
            </h1>
          </div>
          <p className="text-xs text-charcoal-500 mt-1">
            View received waste shipments pending treatment, record disposal completion quantities
            and dates, and proceed to certificate issuance.
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>

          <div className="flex items-center gap-2">
            {feedback.shipmentPublicId && (
              <Link
                to={`/certificates?shipmentId=${feedback.shipmentPublicId}`}
                className="px-3 py-1.5 rounded-lg bg-charcoal-900 hover:bg-charcoal-800 text-white font-bold inline-flex items-center gap-1"
              >
                <FileCheck className="w-3.5 h-3.5 text-periwinkle" />
                <span>Upload Certificate</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-charcoal-500 hover:text-charcoal-800 font-semibold px-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-ivory-300 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('PENDING')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'PENDING'
              ? 'bg-charcoal-900 text-white shadow-xs'
              : 'bg-white text-charcoal-600 border border-ivory-300 hover:bg-ivory-100'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-amber" />
          <span>Received &amp; Pending Disposal</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === 'PENDING'
                ? 'bg-periwinkle text-charcoal-900'
                : 'bg-ivory-200 text-charcoal-700'
            }`}
          >
            {pendingDisposalShipments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('COMPLETED')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'COMPLETED'
              ? 'bg-charcoal-900 text-white shadow-xs'
              : 'bg-white text-charcoal-600 border border-ivory-300 hover:bg-ivory-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Completed Disposals (DISPOSED)</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === 'COMPLETED'
                ? 'bg-periwinkle text-charcoal-900'
                : 'bg-ivory-200 text-charcoal-700'
            }`}
          >
            {completedDisposalShipments.length}
          </span>
        </button>
      </div>

      {/* Shipments Cards / Table */}
      {isLoading ? (
        <LoadingSkeleton type="card" count={3} />
      ) : displayedList.length === 0 ? (
        <EmptyState
          icon={Flame}
          title={
            activeTab === 'PENDING'
              ? 'No received shipments awaiting disposal'
              : 'No completed disposals recorded yet'
          }
          description={
            activeTab === 'PENDING'
              ? 'Receive an incoming shipment first, or switch to the Completed Disposals tab.'
              : 'Once received shipments are processed for disposal or certified, they will appear here.'
          }
        />
      ) : (
        <div className="space-y-4">
          {displayedList.map((shipment) => {
            const targetId = shipment.public_id || String(shipment.id);
            return (
              <div
                key={targetId}
                className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle hover:shadow-card transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/shipments/${targetId}`, { state: { shipment } })
                      }
                      className="font-mono text-sm font-bold text-charcoal-900 hover:text-periwinkle-700 hover:underline cursor-pointer"
                    >
                      {shipment.shipment_code}
                    </button>
                    <StatusBadge status={shipment.status} />
                    {shipment.certificate_info ? (
                      <StatusBadge
                        status="CERTIFIED"
                        customLabel={`Cert: ${shipment.certificate_info.certificate_number}`}
                      />
                    ) : (
                      <StatusBadge status="PENDING_UPLOAD" customLabel="Certificate Pending" />
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-charcoal-600">
                    <div>
                      Source:{' '}
                      <strong className="text-charcoal-800">
                        {shipment.warehouse_name || `Intake #${shipment.intake_id}`}
                      </strong>
                    </div>
                    <div>
                      Received At:{' '}
                      <strong className="text-charcoal-800">
                        {formatDateTime(shipment.received_at)}
                      </strong>
                    </div>
                    <div>
                      Received Weight:{' '}
                      <strong className="font-mono text-emerald-700">
                        {formatWeight(shipment.received_weight_kg ?? shipment.expected_weight_kg)}
                      </strong>{' '}
                      <span className="text-charcoal-400">
                        (Exp: {formatWeight(shipment.expected_weight_kg)})
                      </span>
                    </div>
                  </div>

                  {/* Waste categories pills */}
                  {shipment.items && shipment.items.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {shipment.items.map((it) => (
                        <span
                          key={it.id}
                          className="px-2 py-0.5 rounded-md bg-ivory-100 border border-ivory-300 text-[11px] text-charcoal-700 font-medium"
                        >
                          {it.bin_color ? `${it.bin_color} · ` : ''}
                          {it.waste_type ? formatEnumLabel(it.waste_type) : `Item #${it.id}`}:{' '}
                          <strong className="font-mono">
                            {formatWeight(it.received_weight_kg ?? it.expected_weight_kg)}
                          </strong>
                        </span>
                      ))}
                    </div>
                  )}

                  {shipment.notes && (
                    <p className="text-xs text-charcoal-500 bg-ivory-50 px-3 py-2 rounded-lg border border-ivory-200 whitespace-pre-line">
                      {shipment.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/shipments/${targetId}`, { state: { shipment } })
                    }
                    className="px-3 py-2 rounded-xl border border-ivory-300 bg-white hover:bg-ivory-100 text-xs font-semibold text-charcoal-700 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openDisposalModal(shipment)}
                    className="px-3.5 py-2 rounded-xl bg-periwinkle hover:bg-periwinkle-400 text-charcoal-900 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>
                      {shipment.status === 'DISPOSED'
                        ? 'Update Disposal Record'
                        : 'Record Disposal Completion'}
                    </span>
                  </button>

                  {!shipment.certificate_info && (
                    <Link
                      to={`/certificates?shipmentId=${targetId}`}
                      className="px-3.5 py-2 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <FileCheck className="w-3.5 h-3.5 text-periwinkle" />
                      <span>Upload Certificate</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Disposal Completion Modal */}
      <Modal
        isOpen={Boolean(selectedShipment)}
        onClose={() => {
          setSelectedShipment(null);
          setModalError(null);
          setSearchParams({});
        }}
        title={
          selectedShipment
            ? `Record Disposal Completion — ${selectedShipment.shipment_code}`
            : 'Record Disposal'
        }
        subtitle="Update treatment completion parameters and transition shipment to DISPOSED"
        maxWidth="lg"
      >
        {selectedShipment && (
          <form onSubmit={handleDisposalSubmit} className="space-y-4 text-xs">
            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-ivory-50 border border-ivory-200 grid grid-cols-2 gap-3">
              <div>
                <span className="text-charcoal-500 block">Expected Weight</span>
                <span className="font-mono font-bold text-charcoal-900 text-sm">
                  {formatWeight(selectedShipment.expected_weight_kg)}
                </span>
              </div>
              <div>
                <span className="text-charcoal-500 block">Verified Received Weight</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {formatWeight(
                    selectedShipment.received_weight_kg ?? selectedShipment.expected_weight_kg
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-charcoal-700 mb-1.5">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-charcoal-400" />
                    Disposal Completion Date &amp; Time *
                  </span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={disposalDate}
                  onChange={(e) => setDisposalDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-ivory-300 rounded-xl text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>

              <div>
                <label className="block font-semibold text-charcoal-700 mb-1.5">
                  <span className="inline-flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-charcoal-400" />
                    Final Disposed Quantity (kg) *
                  </span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={disposedWeight}
                  onChange={(e) => setDisposedWeight(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-ivory-300 rounded-xl font-mono font-bold text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-charcoal-700 mb-1.5">
                Treatment / Disposal Method *
              </label>
              <select
                value={disposalMethod}
                onChange={(e) => setDisposalMethod(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-ivory-300 rounded-xl text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-periwinkle"
              >
                {DISPOSAL_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-charcoal-700 mb-1.5">
                Disposal Remarks &amp; Batch / Kiln Log Reference
              </label>
              <textarea
                rows={3}
                value={disposalRemarks}
                onChange={(e) => setDisposalRemarks(e.target.value)}
                placeholder="e.g., Incinerator Kiln #1 Batch B-2026-11, secondary chamber temp 1050°C, complete destruction verified..."
                className="w-full px-3 py-2 bg-white border border-ivory-300 rounded-xl text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-periwinkle"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-ivory-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedShipment(null);
                  setModalError(null);
                  setSearchParams({});
                }}
                className="px-4 py-2 rounded-xl border border-ivory-300 bg-white hover:bg-ivory-100 text-charcoal-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordDisposalMutation.isPending}
                className="px-4 py-2 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-white font-bold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {recordDisposalMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-periwinkle" />
                    <span>Saving Disposal Record...</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-3.5 h-3.5 text-periwinkle" />
                    <span>Confirm Disposal Completion</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
