import React from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Scale,
  Flame,
  FileCheck,
  Warehouse,
  Truck,
  Boxes,
  FileText,
  AlertTriangle,
  Download,
  MapPin,
  Layers,
} from 'lucide-react';
import { facilityShipmentsApi, facilityCertificatesApi } from '../api/facility';
import { DisposalShipment } from '../types/facility';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { formatDateTime, formatDate, formatWeight, formatEnumLabel } from '../utils/formatters';
import { getErrorMessage } from '../api/client';

const BIN_COLOR_STYLES: Record<string, string> = {
  YELLOW: 'bg-amber-100 text-amber-900 border-amber-300',
  RED: 'bg-rose-100 text-rose-900 border-rose-300',
  WHITE: 'bg-ivory-100 text-charcoal-800 border-charcoal-300',
  BLUE: 'bg-periwinkle-100 text-periwinkle-900 border-periwinkle-300',
  BROWN: 'bg-amber-900/10 text-amber-950 border-amber-800/30',
};

export const ShipmentDetails: React.FC = () => {
  const { shipmentId } = useParams<{ shipmentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const stateShipment = (location.state as { shipment?: DisposalShipment } | null)?.shipment;

  const cachedShipment = React.useMemo(() => {
    if (stateShipment) return stateShipment;
    if (!shipmentId) return undefined;
    const list = queryClient.getQueryData<DisposalShipment[]>(['facilityShipments']);
    if (!list) return undefined;
    const target = shipmentId.toLowerCase();
    return list.find(
      (s) =>
        String(s.public_id || '').toLowerCase() === target ||
        String(s.id || '').toLowerCase() === target ||
        String(s.shipment_code || '').toLowerCase() === target
    );
  }, [stateShipment, shipmentId, queryClient]);

  const {
    data: fetchedShipment,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['facilityShipmentDetail', shipmentId],
    queryFn: () => facilityShipmentsApi.getById(shipmentId!),
    enabled: Boolean(shipmentId),
    initialData: cachedShipment,
  });

  const shipment = fetchedShipment ?? cachedShipment;

  const handleDownloadCertificate = async () => {
    if (!shipment) return;
    try {
      const targetId = shipment.public_id || String(shipment.id);
      const res = await facilityCertificatesApi.getSignedUrl(targetId);
      if (res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  if (isLoading && !shipment) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={3} />
      </div>
    );
  }

  if (!shipment) {
    return (
      <ErrorState
        title="Shipment details unavailable"
        message={isError ? getErrorMessage(error) : 'The requested shipment could not be found.'}
        onRetry={() => refetch()}
      />
    );
  }

  const targetId = shipment.public_id || String(shipment.id);
  const items = shipment.items ?? [];
  const pickupsSummary = shipment.pickups_summary ?? [];
  const pickupCount = shipment.pickup_count ?? pickupsSummary.length;

  const expectedTotal = Number(shipment.expected_weight_kg || 0);
  const receivedTotal =
    shipment.received_weight_kg !== null && shipment.received_weight_kg !== undefined
      ? Number(shipment.received_weight_kg)
      : null;
  const variance = receivedTotal !== null ? receivedTotal - expectedTotal : null;

  return (
    <div className="space-y-6">
      {/* Top Bar Navigation & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/shipments')}
            className="p-2 rounded-xl border border-ivory-300 bg-white hover:bg-ivory-100 text-charcoal-700 transition-colors cursor-pointer"
            title="Back to Incoming Shipments"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold font-mono text-charcoal-900 tracking-tight">
                {shipment.shipment_code}
              </h1>
              <StatusBadge status={shipment.status} size="md" />
            </div>
            <p className="text-xs text-charcoal-500 mt-0.5 font-mono">
              Shipment Reference: {shipment.public_id || `#${shipment.id}`}
            </p>
          </div>
        </div>

        {/* Contextual Lifecycle Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {shipment.status === 'IN_TRANSIT' && (
            <Link
              to={`/receive?shipmentId=${targetId}`}
              className="px-4 py-2.5 rounded-xl bg-periwinkle hover:bg-periwinkle-400 text-charcoal-900 text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors"
            >
              <Scale className="w-4 h-4" />
              <span>Receive This Shipment</span>
            </Link>
          )}

          {(shipment.status === 'RECEIVED' || shipment.status === 'DISCREPANCY') && (
            <Link
              to={`/disposal?shipmentId=${targetId}`}
              className="px-4 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold inline-flex items-center gap-2 transition-colors"
            >
              <Flame className="w-4 h-4" />
              <span>Record Disposal Completion</span>
            </Link>
          )}

          {['RECEIVED', 'DISCREPANCY', 'DISPOSED'].includes(shipment.status) &&
            !shipment.certificate_info && (
              <Link
                to={`/certificates?shipmentId=${targetId}`}
                className="px-4 py-2.5 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors"
              >
                <FileCheck className="w-4 h-4 text-periwinkle" />
                <span>Upload Disposal Certificate</span>
              </Link>
            )}

          {shipment.certificate_info && (
            <button
              type="button"
              onClick={handleDownloadCertificate}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Certificate ({shipment.certificate_info.certificate_number})</span>
            </button>
          )}
        </div>
      </div>

      {/* Discrepancy Callout Banner if present */}
      {(shipment.status === 'DISCREPANCY' || shipment.discrepancy_reason) && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 space-y-1">
            <p className="font-bold">Weight / Quantity Discrepancy Flagged on Receipt</p>
            <p className="text-amber-900">
              {shipment.discrepancy_reason ||
                `Expected ${formatWeight(expectedTotal)}, received ${formatWeight(
                  receivedTotal
                )} (Difference: ${
                  variance !== null ? `${variance > 0 ? '+' : ''}${variance.toFixed(2)} kg` : '—'
                }).`}
            </p>
          </div>
        </div>
      )}

      {/* Summary Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Source Warehouse & Intake */}
        <div className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-charcoal-500 uppercase tracking-wider">
            <Warehouse className="w-4 h-4 text-periwinkle-700" />
            <span>Source Warehouse &amp; Intake</span>
          </div>
          <div className="space-y-2 text-xs pt-1">
            <div className="flex justify-between">
              <span className="text-charcoal-500">Warehouse Name:</span>
              <span className="font-semibold text-charcoal-900 text-right">
                {shipment.warehouse_name || `Warehouse Intake #${shipment.intake_id || '—'}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-charcoal-500">Warehouse Code:</span>
              <span className="font-mono font-semibold text-charcoal-800">
                {shipment.warehouse_code || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-charcoal-500">Location:</span>
              <span className="text-charcoal-800 text-right">
                {shipment.warehouse_address
                  ? `${shipment.warehouse_address}, ${shipment.warehouse_city || ''}`
                  : shipment.warehouse_city || '—'}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-ivory-200">
              <span className="text-charcoal-500">Warehouse Intake Code:</span>
              <span className="font-mono font-semibold text-periwinkle-800">
                {shipment.intake_code || `INT-#${shipment.intake_id}`}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Dispatch & Transport Details */}
        <div className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-charcoal-500 uppercase tracking-wider">
            <Truck className="w-4 h-4 text-periwinkle-700" />
            <span>Dispatch &amp; Transport Details</span>
          </div>
          <div className="space-y-2 text-xs pt-1">
            <div className="flex justify-between">
              <span className="text-charcoal-500">Dispatched At:</span>
              <span className="font-semibold text-charcoal-900">
                {formatDateTime(shipment.dispatched_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-charcoal-500">Received At Facility:</span>
              <span className="font-semibold text-charcoal-900">
                {shipment.received_at ? formatDateTime(shipment.received_at) : 'Awaiting Receipt'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-charcoal-500">Collection Route:</span>
              <span className="font-mono font-semibold text-charcoal-800">
                {shipment.route_code || '—'}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-ivory-200">
              <span className="text-charcoal-500">Transport Vehicle:</span>
              <span className="font-mono font-semibold text-charcoal-800">
                {shipment.vehicle_registration || 'Authorized Transporter'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Weight Reconciliation & Pickups Summary */}
        <div className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-charcoal-500 uppercase tracking-wider">
            <Scale className="w-4 h-4 text-periwinkle-700" />
            <span>Mass Reconciliation Summary</span>
          </div>
          <div className="space-y-2 text-xs pt-1">
            <div className="flex justify-between">
              <span className="text-charcoal-500">Expected Waste Weight:</span>
              <span className="font-mono font-bold text-charcoal-900">
                {formatWeight(shipment.expected_weight_kg)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-charcoal-500">Actual Received Weight:</span>
              <span className="font-mono font-bold text-emerald-700">
                {receivedTotal !== null ? formatWeight(receivedTotal) : 'Not weighed yet'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-charcoal-500">Weight Variance:</span>
              <span
                className={`font-mono font-bold ${
                  variance === null
                    ? 'text-charcoal-400'
                    : Math.abs(variance) > 0.01
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {variance === null
                  ? '—'
                  : `${variance > 0 ? '+' : ''}${variance.toFixed(2)} kg`}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-ivory-200">
              <span className="text-charcoal-500">Pickups Included:</span>
              <span className="font-bold text-charcoal-900">
                {pickupCount} pickup(s) · {items.length} waste stream(s)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expected Waste Categories & Weights Table */}
      <section className="bg-white rounded-xl border border-ivory-300 shadow-subtle overflow-hidden">
        <div className="px-5 py-4 border-b border-ivory-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-periwinkle-700" />
            <div>
              <h2 className="text-sm font-bold text-charcoal-900">
                Waste Categories &amp; Stream Breakdown
              </h2>
              <p className="text-xs text-charcoal-500">
                Classified biomedical / pharmaceutical waste streams included in this shipment
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-charcoal-600">
            {items.length} Category Item(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-charcoal">
            <thead className="bg-ivory-100/70 border-b border-ivory-200 text-xs font-semibold text-charcoal-600 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Item ID</th>
                <th className="py-3 px-4">Bin Color</th>
                <th className="py-3 px-4">Waste Category</th>
                <th className="py-3 px-4">Expected Weight</th>
                <th className="py-3 px-4">Actual Received Weight</th>
                <th className="py-3 px-4">Variance</th>
                <th className="py-3 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-200 text-xs">
              {items.map((item) => {
                const exp = Number(item.expected_weight_kg || 0);
                const rec =
                  item.received_weight_kg !== null && item.received_weight_kg !== undefined
                    ? Number(item.received_weight_kg)
                    : null;
                const diff = rec !== null ? rec - exp : null;
                const binStyle =
                  (item.bin_color && BIN_COLOR_STYLES[item.bin_color]) ||
                  'bg-ivory-200 text-charcoal-800 border-ivory-300';

                return (
                  <tr key={item.id} className="hover:bg-ivory-50/70">
                    <td className="py-3.5 px-4 font-mono font-semibold text-charcoal-700">
                      #{item.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${binStyle}`}
                      >
                        {item.bin_color || 'STANDARD'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-charcoal-900">
                      {item.waste_type
                        ? formatEnumLabel(item.waste_type)
                        : `Intake Item #${item.warehouse_intake_item_id}`}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-charcoal-900">
                      {formatWeight(item.expected_weight_kg)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                      {rec !== null ? formatWeight(rec) : '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold">
                      {diff === null ? (
                        <span className="text-charcoal-400">—</span>
                      ) : (
                        <span
                          className={
                            Math.abs(diff) > 0.01 ? 'text-amber-700 font-bold' : 'text-emerald-700'
                          }
                        >
                          {diff > 0 ? '+' : ''}
                          {diff.toFixed(2)} kg
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-charcoal-600">{item.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Associated Pickups Included in Shipment */}
      <section className="bg-white rounded-xl border border-ivory-300 shadow-subtle overflow-hidden">
        <div className="px-5 py-4 border-b border-ivory-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-periwinkle-700" />
            <div>
              <h2 className="text-sm font-bold text-charcoal-900">
                Associated Pickups in Consignment ({pickupCount})
              </h2>
              <p className="text-xs text-charcoal-500">
                Upstream generator pickups aggregated into Warehouse Intake{' '}
                {shipment.intake_code || `#${shipment.intake_id}`}
              </p>
            </div>
          </div>
        </div>

        {pickupsSummary.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-charcoal">
              <thead className="bg-ivory-100/70 border-b border-ivory-200 text-xs font-semibold text-charcoal-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Pickup Code</th>
                  <th className="py-3 px-4">Generator ID</th>
                  <th className="py-3 px-4">Generator Category</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4">Estimated Weight</th>
                  <th className="py-3 px-4">Collected Weight</th>
                  <th className="py-3 px-4">Collected At</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200 text-xs">
                {pickupsSummary.map((p) => (
                  <tr key={p.pickup_id} className="hover:bg-ivory-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-charcoal-900">
                      {p.pickup_code}
                    </td>
                    <td className="py-3 px-4 font-mono text-charcoal-700">
                      {p.generator_code || `GEN-#${p.pickup_id}`}
                    </td>
                    <td className="py-3 px-4 text-charcoal-700">
                      {p.generator_type ? formatEnumLabel(p.generator_type) : '—'}
                    </td>
                    <td className="py-3 px-4 text-charcoal-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-charcoal-400" />
                        {p.city || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-charcoal-700">
                      {formatWeight(p.estimated_weight_kg)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-charcoal-900">
                      {formatWeight(p.collected_weight_kg ?? p.estimated_weight_kg)}
                    </td>
                    <td className="py-3 px-4 text-charcoal-500">
                      {formatDateTime(p.collected_at)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-xs text-charcoal-500">
            No individual pickup stop records linked to this warehouse intake route.
          </div>
        )}
      </section>

      {/* Notes, Disposal Remarks & Certificate Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-charcoal-500 uppercase tracking-wider">
            <FileText className="w-4 h-4 text-periwinkle-700" />
            <span>Manifest &amp; Operational Remarks</span>
          </div>
          {shipment.notes ? (
            <pre className="text-xs text-charcoal-800 whitespace-pre-wrap font-sans bg-ivory-50 p-3.5 rounded-lg border border-ivory-200 leading-relaxed">
              {shipment.notes}
            </pre>
          ) : (
            <p className="text-xs text-charcoal-400 italic">
              No manifest notes or disposal remarks recorded for this shipment.
            </p>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-charcoal-500 uppercase tracking-wider">
            <FileCheck className="w-4 h-4 text-periwinkle-700" />
            <span>Disposal Certificate Status</span>
          </div>
          {shipment.certificate_info ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-charcoal-500">Certificate Number:</span>
                <span className="font-mono font-bold text-emerald-800">
                  {shipment.certificate_info.certificate_number}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-charcoal-500">Registry Code:</span>
                <span className="font-mono text-charcoal-800">
                  {shipment.certificate_info.certificate_code}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-charcoal-500">Uploaded File:</span>
                <span className="font-medium text-charcoal-800">
                  {shipment.certificate_info.file_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-charcoal-500">Issued Date:</span>
                <span className="text-charcoal-800">
                  {formatDate(shipment.certificate_info.issued_at)}
                </span>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadCertificate}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>View / Download Official Certificate</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <p className="text-charcoal-500">
                No disposal certificate has been uploaded for this shipment yet.
              </p>
              {['RECEIVED', 'DISCREPANCY', 'DISPOSED'].includes(shipment.status) && (
                <Link
                  to={`/certificates?shipmentId=${targetId}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-periwinkle hover:bg-periwinkle-400 text-charcoal-900 font-bold text-xs transition-colors"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Upload Certificate Now</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
