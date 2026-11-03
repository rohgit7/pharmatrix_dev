import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Truck,
  ArrowRight,
  Check,
  Loader2,
  Flame,
  Eye,
} from 'lucide-react';
import { facilityShipmentsApi } from '../api/facility';
import { DisposalShipment } from '../types/facility';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { formatDateTime, formatWeight, formatEnumLabel } from '../utils/formatters';
import { getErrorMessage } from '../api/client';

export const ReceiveShipment: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedId = searchParams.get('shipmentId') || '';

  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(preselectedId);
  const [arrivalConfirmed, setArrivalConfirmed] = useState<boolean>(false);
  const [itemWeights, setItemWeights] = useState<Record<number, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
  const [discrepancyReason, setDiscrepancyReason] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [receivedSuccessShipment, setReceivedSuccessShipment] =
    useState<DisposalShipment | null>(null);

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['facilityShipments'],
    queryFn: facilityShipmentsApi.list,
  });

  const inTransitShipments = useMemo(
    () => shipments.filter((s) => s.status === 'IN_TRANSIT'),
    [shipments]
  );

  // Auto-select first IN_TRANSIT shipment if none selected
  useEffect(() => {
    if (preselectedId) {
      setSelectedShipmentId(preselectedId);
    } else if (!selectedShipmentId && inTransitShipments.length > 0) {
      setSelectedShipmentId(inTransitShipments[0].public_id);
    }
  }, [preselectedId, inTransitShipments, selectedShipmentId]);

  const activeShipment = useMemo(
    () => shipments.find((s) => s.public_id === selectedShipmentId) || null,
    [shipments, selectedShipmentId]
  );

  // Initialize item weight inputs when active shipment changes
  useEffect(() => {
    if (activeShipment && activeShipment.items) {
      const initialWeights: Record<number, string> = {};
      const initialNotes: Record<number, string> = {};
      for (const item of activeShipment.items) {
        initialWeights[item.id] = String(Number(item.expected_weight_kg).toFixed(2));
        initialNotes[item.id] = item.notes || '';
      }
      setItemWeights(initialWeights);
      setItemNotes(initialNotes);
      setArrivalConfirmed(false);
      setDiscrepancyReason('');
      setRemarks(activeShipment.notes || '');
      setFormError(null);
    }
  }, [activeShipment?.public_id]);

  // Compute expected vs actual weights and discrepancies
  const weightSummary = useMemo(() => {
    if (!activeShipment) {
      return {
        expectedTotal: 0,
        actualTotal: 0,
        totalDiff: 0,
        hasAnyDiscrepancy: false,
        exceedsTolerance: false,
      };
    }

    const expectedTotal = Number(activeShipment.expected_weight_kg || 0);
    let actualTotal = 0;
    let hasItemDiscrepancy = false;

    for (const item of activeShipment.items) {
      const exp = Number(item.expected_weight_kg || 0);
      const val = parseFloat(itemWeights[item.id] ?? '');
      if (!isNaN(val)) {
        actualTotal += val;
        if (Math.abs(val - exp) > 0.01) {
          hasItemDiscrepancy = true;
        }
      }
    }

    const totalDiff = actualTotal - expectedTotal;
    const hasAnyDiscrepancy = hasItemDiscrepancy || Math.abs(totalDiff) > 0.01;
    // Default facility tolerance is 5.0 kg (or any noticeable discrepancy > 0.5 kg)
    const exceedsTolerance = Math.abs(totalDiff) > 5.0;

    return {
      expectedTotal,
      actualTotal,
      totalDiff,
      hasAnyDiscrepancy,
      exceedsTolerance,
    };
  }, [activeShipment, itemWeights]);

  const receiveMutation = useMutation({
    mutationFn: (payload: {
      shipmentPublicId: string;
      items: Array<{ shipment_item_id: number; received_weight_kg: number; notes?: string | null }>;
      notes?: string | null;
      discrepancy_reason?: string | null;
    }) =>
      facilityShipmentsApi.receive(payload.shipmentPublicId, {
        items: payload.items,
        notes: payload.notes,
        discrepancy_reason: payload.discrepancy_reason,
      }),
    onSuccess: (updatedShipment) => {
      queryClient.invalidateQueries({ queryKey: ['facilityShipments'] });
      queryClient.invalidateQueries({
        queryKey: ['facilityShipmentDetail', updatedShipment.public_id],
      });
      setReceivedSuccessShipment(updatedShipment);
      setFormError(null);
    },
    onError: (err) => {
      setFormError(getErrorMessage(err));
    },
  });

  const handleSelectShipment = (publicId: string) => {
    setSelectedShipmentId(publicId);
    setReceivedSuccessShipment(null);
    if (publicId) {
      setSearchParams({ shipmentId: publicId });
    } else {
      setSearchParams({});
    }
  };

  const handleMatchExpected = () => {
    if (!activeShipment) return;
    const matched: Record<number, string> = {};
    for (const item of activeShipment.items) {
      matched[item.id] = String(Number(item.expected_weight_kg).toFixed(2));
    }
    setItemWeights(matched);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!activeShipment) {
      setFormError('Please select a shipment to receive.');
      return;
    }

    if (activeShipment.status !== 'IN_TRANSIT') {
      setFormError(
        `Shipment ${activeShipment.shipment_code} cannot be received because its status is ${activeShipment.status}. Only IN_TRANSIT shipments can be received.`
      );
      return;
    }

    if (!arrivalConfirmed) {
      setFormError(
        'Please confirm physical arrival of the shipment and seal verification at your facility.'
      );
      return;
    }

    const itemsPayload: Array<{
      shipment_item_id: number;
      received_weight_kg: number;
      notes?: string | null;
    }> = [];

    for (const item of activeShipment.items) {
      const rawWeight = itemWeights[item.id];
      const parsed = parseFloat(rawWeight);
      if (rawWeight === undefined || rawWeight.trim() === '' || isNaN(parsed) || parsed < 0) {
        setFormError(
          `Please enter a valid non-negative received weight for Waste Stream Item #${item.id}.`
        );
        return;
      }
      itemsPayload.push({
        shipment_item_id: item.id,
        received_weight_kg: Number(parsed.toFixed(2)),
        notes: itemNotes[item.id]?.trim() || null,
      });
    }

    if (weightSummary.hasAnyDiscrepancy && !discrepancyReason.trim() && !remarks.trim()) {
      setFormError(
        'A discrepancy between expected and received weights was detected. Please provide a discrepancy reason or remarks before submitting.'
      );
      return;
    }

    const combinedNotes = [
      remarks.trim(),
      discrepancyReason.trim() ? `[Discrepancy Reason] ${discrepancyReason.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    receiveMutation.mutate({
      shipmentPublicId: activeShipment.public_id,
      items: itemsPayload,
      notes: combinedNotes || null,
      discrepancy_reason: discrepancyReason.trim() || null,
    });
  };

  if (isLoading) {
    return <LoadingSkeleton type="card" count={2} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-periwinkle-700" />
            <h1 className="text-xl font-bold text-charcoal-900 tracking-tight">
              Receive &amp; Verify Waste Shipment
            </h1>
          </div>
          <p className="text-xs text-charcoal-500 mt-1">
            Confirm consignment arrival, record actual weighbridge quantities per waste category,
            and report any weight discrepancies.
          </p>
        </div>
      </div>

      {/* Success Banner after receiving */}
      {receivedSuccessShipment && (
        <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-950 text-sm">
                  Shipment {receivedSuccessShipment.shipment_code} Received Successfully
                </span>
                <StatusBadge status={receivedSuccessShipment.status} />
              </div>
              <p className="text-emerald-800">
                Recorded total received weight:{' '}
                <strong>{formatWeight(receivedSuccessShipment.received_weight_kg)}</strong> (Expected:{' '}
                {formatWeight(receivedSuccessShipment.expected_weight_kg)}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Link
              to={`/shipments/${receivedSuccessShipment.public_id}`}
              className="px-3 py-2 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View Receipt</span>
            </Link>
            <Link
              to={`/disposal?shipmentId=${receivedSuccessShipment.public_id}`}
              className="px-3.5 py-2 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
            >
              <Flame className="w-3.5 h-3.5 text-amber" />
              <span>Proceed to Disposal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Shipment Selector Bar */}
      <div className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle space-y-3">
        <label
          htmlFor="shipment-selector"
          className="block text-xs font-bold text-charcoal-700 uppercase tracking-wider"
        >
          Select Consignment Shipment to Receive
        </label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <select
            id="shipment-selector"
            value={selectedShipmentId}
            onChange={(e) => handleSelectShipment(e.target.value)}
            className="flex-1 h-11 px-3.5 text-sm bg-ivory-50 border border-ivory-300 rounded-xl text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-periwinkle"
          >
            <option value="">-- Select a shipment --</option>
            {shipments.map((s) => (
              <option key={s.public_id} value={s.public_id}>
                {s.shipment_code} — {s.warehouse_name || `Intake #${s.intake_id}`} — Expected:{' '}
                {formatWeight(s.expected_weight_kg)} [{s.status}]
              </option>
            ))}
          </select>

          {activeShipment && (
            <Link
              to={`/shipments/${activeShipment.public_id}`}
              className="px-3.5 py-2.5 rounded-xl border border-ivory-300 bg-white hover:bg-ivory-100 text-xs font-semibold text-charcoal-700 inline-flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Full Shipment Details</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main Content */}
      {!activeShipment ? (
        inTransitShipments.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No in-transit shipments awaiting receipt"
            description="All dispatched shipments assigned to your facility have already been received."
          />
        ) : (
          <EmptyState
            icon={Scale}
            title="Select an incoming shipment above"
            description="Choose an IN_TRANSIT consignment from the dropdown to record its arrival and weighbridge measurements."
          />
        )
      ) : activeShipment.status !== 'IN_TRANSIT' ? (
        /* Guard against receiving shipments not in IN_TRANSIT state */
        <div className="bg-white p-6 rounded-xl border border-ivory-300 shadow-subtle space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-charcoal-900">
                  Shipment {activeShipment.shipment_code} Cannot Be Received Again
                </h2>
                <StatusBadge status={activeShipment.status} />
              </div>
              <p className="text-xs text-charcoal-600 leading-relaxed">
                Only shipments in the <strong>IN_TRANSIT</strong> state can be received. This
                consignment has already been received at{' '}
                <strong>{formatDateTime(activeShipment.received_at)}</strong> with a recorded weight
                of <strong>{formatWeight(activeShipment.received_weight_kg)}</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to={`/shipments/${activeShipment.public_id}`}
              className="px-3.5 py-2 rounded-xl border border-ivory-300 bg-ivory-50 hover:bg-ivory-100 text-xs font-semibold text-charcoal-800 inline-flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect Shipment Details</span>
            </Link>
            {(activeShipment.status === 'RECEIVED' || activeShipment.status === 'DISCREPANCY') && (
              <Link
                to={`/disposal?shipmentId=${activeShipment.public_id}`}
                className="px-3.5 py-2 rounded-xl bg-periwinkle hover:bg-periwinkle-400 text-charcoal-900 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Manage Disposal for {activeShipment.shipment_code}</span>
              </Link>
            )}
          </div>
        </div>
      ) : (
        /* Active Receipt Form for IN_TRANSIT Shipment */
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-900 font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Shipment Context Banner */}
          <div className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-charcoal-500 block">Consignment ID</span>
              <span className="font-mono font-bold text-sm text-charcoal-900 mt-0.5 block">
                {activeShipment.shipment_code}
              </span>
            </div>
            <div>
              <span className="text-charcoal-500 block">Source Warehouse</span>
              <span className="font-semibold text-charcoal-900 mt-0.5 block">
                {activeShipment.warehouse_name ||
                  activeShipment.warehouse_code ||
                  `Intake #${activeShipment.intake_id}`}
              </span>
            </div>
            <div>
              <span className="text-charcoal-500 block">Dispatched Timestamp</span>
              <span className="font-semibold text-charcoal-900 mt-0.5 block">
                {formatDateTime(activeShipment.dispatched_at)}
              </span>
            </div>
            <div>
              <span className="text-charcoal-500 block">Expected Total Weight</span>
              <span className="font-mono font-bold text-sm text-charcoal-900 mt-0.5 block">
                {formatWeight(activeShipment.expected_weight_kg)}
              </span>
            </div>
          </div>

          {/* Step 1: Confirm Shipment Arrival */}
          <div className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={arrivalConfirmed}
                onChange={(e) => setArrivalConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-ivory-400 text-periwinkle focus:ring-periwinkle"
              />
              <div>
                <span className="text-sm font-bold text-charcoal-900 block">
                  1. Confirm Physical Shipment Arrival &amp; Seal Verification
                </span>
                <span className="text-xs text-charcoal-500 mt-0.5 block">
                  I confirm that transport consignment{' '}
                  <strong className="font-mono text-charcoal-800">
                    {activeShipment.shipment_code}
                  </strong>{' '}
                  has physically arrived at the disposal facility gate and containers have been
                  placed on the calibrated facility scale.
                </span>
              </div>
            </label>
          </div>

          {/* Step 2 & 3: Enter Received Weight by Waste Category */}
          <div className="bg-white rounded-xl border border-ivory-300 shadow-subtle overflow-hidden">
            <div className="px-5 py-4 border-b border-ivory-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-charcoal-900">
                  2. Record Actual Received Weight by Waste Category
                </h2>
                <p className="text-xs text-charcoal-500">
                  Enter the verified weighbridge weight (kg) for each waste stream item in this
                  shipment
                </p>
              </div>
              <button
                type="button"
                onClick={handleMatchExpected}
                className="self-start sm:self-auto px-3 py-1.5 rounded-lg border border-ivory-300 bg-ivory-50 hover:bg-ivory-100 text-xs font-semibold text-charcoal-700 inline-flex items-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Match Expected Weights</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-charcoal">
                <thead className="bg-ivory-100/70 border-b border-ivory-200 text-xs font-semibold text-charcoal-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Bin / Waste Category</th>
                    <th className="py-3 px-4">Expected Weight (kg)</th>
                    <th className="py-3 px-4">Actual Received Weight (kg) *</th>
                    <th className="py-3 px-4">Discrepancy</th>
                    <th className="py-3 px-4">Category Note (Optional)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ivory-200 text-xs">
                  {activeShipment.items.map((item) => {
                    const exp = Number(item.expected_weight_kg || 0);
                    const recVal = parseFloat(itemWeights[item.id] ?? '');
                    const diff = !isNaN(recVal) ? recVal - exp : null;
                    const hasDiff = diff !== null && Math.abs(diff) > 0.01;

                    return (
                      <tr
                        key={item.id}
                        className={hasDiff ? 'bg-amber-50/40' : 'hover:bg-ivory-50/60'}
                      >
                        <td className="py-3.5 px-4 font-mono font-semibold text-charcoal-700">
                          #{item.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-charcoal-900">
                            {item.waste_type
                              ? formatEnumLabel(item.waste_type)
                              : `Intake Item #${item.warehouse_intake_item_id}`}
                          </div>
                          {item.bin_color && (
                            <span className="text-[11px] font-mono text-charcoal-500">
                              Bin: {item.bin_color}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-charcoal-900">
                          {exp.toFixed(2)} kg
                        </td>
                        <td className="py-3.5 px-4">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={itemWeights[item.id] ?? ''}
                            onChange={(e) =>
                              setItemWeights((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            className={`w-36 px-3 py-1.5 rounded-lg border font-mono text-xs font-bold focus:outline-none focus:ring-2 ${
                              hasDiff
                                ? 'border-amber-400 bg-white text-amber-900 focus:ring-amber-400'
                                : 'border-ivory-300 bg-white text-charcoal-900 focus:ring-periwinkle'
                            }`}
                          />
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold">
                          {diff === null ? (
                            <span className="text-charcoal-400">—</span>
                          ) : hasDiff ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              {diff > 0 ? '+' : ''}
                              {diff.toFixed(2)} kg
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <Check className="w-3.5 h-3.5" />
                              Exact Match
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <input
                            type="text"
                            placeholder="Optional stream note..."
                            value={itemNotes[item.id] ?? ''}
                            onChange={(e) =>
                              setItemNotes((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            className="w-full min-w-[160px] px-2.5 py-1.5 rounded-lg border border-ivory-300 bg-white text-xs text-charcoal-800 focus:outline-none focus:ring-1 focus:ring-periwinkle"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-ivory-100/80 border-t border-ivory-300 text-xs font-bold">
                  <tr>
                    <td colSpan={2} className="py-3.5 px-4 text-charcoal-800 uppercase">
                      Total Consignment Mass
                    </td>
                    <td className="py-3.5 px-4 font-mono text-charcoal-900">
                      {weightSummary.expectedTotal.toFixed(2)} kg
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-800 text-sm">
                      {weightSummary.actualTotal.toFixed(2)} kg
                    </td>
                    <td colSpan={2} className="py-3.5 px-4 font-mono">
                      <span
                        className={
                          Math.abs(weightSummary.totalDiff) > 0.01
                            ? 'text-amber-800'
                            : 'text-emerald-700'
                        }
                      >
                        Net Variance: {weightSummary.totalDiff > 0 ? '+' : ''}
                        {weightSummary.totalDiff.toFixed(2)} kg
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Step 4 & 5: Discrepancy Recording & Remarks */}
          <div className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-charcoal-900">
                3. Discrepancy Reporting &amp; Receipt Remarks
              </h2>
              {weightSummary.hasAnyDiscrepancy && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  {weightSummary.exceedsTolerance
                    ? 'Significant Discrepancy (> 5.0 kg tolerance) — Will Flag DISCREPANCY'
                    : 'Weight Variance Detected — Reason Required'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                  Discrepancy Reason{' '}
                  {weightSummary.hasAnyDiscrepancy ? (
                    <span className="text-rose-600">* (Required for variance)</span>
                  ) : (
                    <span className="text-charcoal-400">(If any)</span>
                  )}
                </label>
                <input
                  type="text"
                  required={weightSummary.hasAnyDiscrepancy}
                  value={discrepancyReason}
                  onChange={(e) => setDiscrepancyReason(e.target.value)}
                  placeholder="e.g., Tare container difference, moisture loss, damaged outer seal..."
                  className="w-full px-3.5 py-2.5 text-xs bg-ivory-50 border border-ivory-300 rounded-xl text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                  Facility Receipt Remarks &amp; Weighbridge Notes
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g., Verified on Weighbridge #2, seal intact..."
                  className="w-full px-3.5 py-2.5 text-xs bg-ivory-50 border border-ivory-300 rounded-xl text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-ivory-200 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={receiveMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm disabled:opacity-60 transition-all"
              >
                {receiveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-periwinkle" />
                    <span>Recording Shipment Receipt...</span>
                  </>
                ) : (
                  <>
                    <Scale className="w-4 h-4 text-periwinkle" />
                    <span>Submit Official Shipment Receipt</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

