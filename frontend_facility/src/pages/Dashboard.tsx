import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck,
  Scale,
  CheckCircle2,
  Flame,
  FileCheck,
  ArrowRight,
  Factory,
  Clock,
  AlertTriangle,
  Eye,
  Upload,
  Download,
  Boxes,
} from 'lucide-react';
import { facilityShipmentsApi, facilityCertificatesApi } from '../api/facility';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { formatDateTime, formatDate, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';

export const Dashboard: React.FC = () => {
  const { facility } = useAuth();
  const navigate = useNavigate();

  const {
    data: shipments = [],
    isLoading: shipmentsLoading,
    isError: shipmentsError,
    error: shipmentsErrObj,
    refetch: refetchShipments,
  } = useQuery({
    queryKey: ['facilityShipments'],
    queryFn: facilityShipmentsApi.list,
    refetchInterval: 15000,
  });

  const {
    data: certificates = [],
    isLoading: certsLoading,
    refetch: refetchCerts,
  } = useQuery({
    queryKey: ['facilityCertificates'],
    queryFn: facilityCertificatesApi.list,
    refetchInterval: 15000,
  });

  const certByShipmentPublicId = useMemo(() => {
    const map = new Map<string, (typeof certificates)[number]>();
    for (const c of certificates) {
      map.set(c.shipment_id, c);
    }
    return map;
  }, [certificates]);

  // Required Dashboard Metrics from real backend data
  const metrics = useMemo(() => {
    const totalIncoming = shipments.length;
    const awaitingReceipt = shipments.filter((s) => s.status === 'IN_TRANSIT').length;
    const receivedCount = shipments.filter((s) =>
      ['RECEIVED', 'DISCREPANCY', 'DISPOSED'].includes(s.status)
    ).length;
    const awaitingDisposal = shipments.filter((s) =>
      ['RECEIVED', 'DISCREPANCY'].includes(s.status)
    ).length;
    const certificatesPendingUpload = shipments.filter(
      (s) =>
        ['RECEIVED', 'DISCREPANCY', 'DISPOSED'].includes(s.status) &&
        !s.certificate_info &&
        !certByShipmentPublicId.has(s.public_id)
    ).length;

    return {
      totalIncoming,
      awaitingReceipt,
      receivedCount,
      awaitingDisposal,
      certificatesPendingUpload,
    };
  }, [shipments, certByShipmentPublicId]);

  const incomingAwaitingReceipt = useMemo(
    () => shipments.filter((s) => s.status === 'IN_TRANSIT').slice(0, 5),
    [shipments]
  );

  const recentShipments = useMemo(() => shipments.slice(0, 6), [shipments]);

  const recentDisposalActivities = useMemo(
    () =>
      shipments
        .filter((s) => ['RECEIVED', 'DISCREPANCY', 'DISPOSED'].includes(s.status))
        .slice(0, 6),
    [shipments]
  );

  const handleDownloadCertificate = async (shipmentPublicId: string) => {
    try {
      const res = await facilityCertificatesApi.getSignedUrl(shipmentPublicId);
      if (res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  if (shipmentsError) {
    return (
      <ErrorState
        title="Unable to load facility dashboard data"
        message={getErrorMessage(shipmentsErrObj)}
        onRetry={() => {
          refetchShipments();
          refetchCerts();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Facility Header Banner */}
      <header className="flex flex-col gap-4 rounded-2xl bg-charcoal-900 p-6 text-white shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-periwinkle" />
            <p className="text-xs font-semibold uppercase tracking-wider text-periwinkle">
              {facility ? `${facility.legal_name} (${facility.facility_code})` : 'CBMWTF Facility Operations'}
            </p>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <h1 className="mt-1.5 text-xl font-bold tracking-tight md:text-2xl">
            Disposal Facility Operational Dashboard
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-charcoal-300">
            Receive inbound pharmaceutical waste consignments from Pharmatrix warehouses, verify
            actual waste weights, log treatment completion, and upload official disposal
            certificates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/receive"
            className="inline-flex items-center gap-1.5 rounded-xl bg-periwinkle px-3.5 py-2 text-xs font-semibold text-charcoal-900 hover:bg-periwinkle-400 transition-colors shadow-sm"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Receive Shipment</span>
          </Link>

          <Link
            to="/certificates"
            className="inline-flex items-center gap-1.5 rounded-xl border border-charcoal-700 bg-charcoal-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-charcoal-700 transition-colors shadow-sm"
          >
            <FileCheck className="h-3.5 w-3.5 text-periwinkle" />
            <span>Upload Certificate</span>
          </Link>
        </div>
      </header>

      {/* 2. Five Required KPI Metric Cards */}
      {shipmentsLoading ? (
        <LoadingSkeleton type="stat-card" count={5} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Incoming Shipments"
            value={metrics.totalIncoming}
            subtitle="All consignments assigned to facility"
            icon={Boxes}
            variant="default"
            onClick={() => navigate('/shipments')}
          />

          <StatCard
            title="Awaiting Receipt"
            value={metrics.awaitingReceipt}
            subtitle="In-transit consignments to verify"
            icon={Truck}
            variant="primary"
            badge={metrics.awaitingReceipt > 0 ? 'In Transit' : 'Clear'}
            badgeType={metrics.awaitingReceipt > 0 ? 'primary' : 'success'}
            onClick={() => navigate('/shipments?status=IN_TRANSIT')}
          />

          <StatCard
            title="Shipments Received"
            value={metrics.receivedCount}
            subtitle="Weighed & confirmed at facility"
            icon={CheckCircle2}
            variant="success"
            onClick={() => navigate('/shipments?status=RECEIVED')}
          />

          <StatCard
            title="Awaiting Disposal"
            value={metrics.awaitingDisposal}
            subtitle="Received & pending treatment completion"
            icon={Flame}
            variant="warning"
            badge={metrics.awaitingDisposal > 0 ? 'Pending' : 'Up to date'}
            badgeType={metrics.awaitingDisposal > 0 ? 'warning' : 'success'}
            onClick={() => navigate('/disposal')}
          />

          <StatCard
            title="Certificates Pending"
            value={metrics.certificatesPendingUpload}
            subtitle="Require PDF certificate upload"
            icon={FileCheck}
            variant={metrics.certificatesPendingUpload > 0 ? 'warning' : 'success'}
            badge={
              metrics.certificatesPendingUpload > 0
                ? `${metrics.certificatesPendingUpload} Pending`
                : 'All Certified'
            }
            badgeType={metrics.certificatesPendingUpload > 0 ? 'warning' : 'success'}
            onClick={() => navigate('/certificates')}
          />
        </div>
      )}

      {/* 3. Incoming Shipments Awaiting Receipt & Recent Shipments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incoming Shipments (Awaiting Receipt) */}
        <section className="bg-white rounded-xl border border-ivory-300 shadow-subtle flex flex-col">
          <div className="px-5 py-4 border-b border-ivory-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-periwinkle-700" />
              <h2 className="text-sm font-bold text-charcoal-900">
                Incoming Shipments Awaiting Receipt
              </h2>
            </div>
            <Link
              to="/shipments?status=IN_TRANSIT"
              className="text-xs font-semibold text-periwinkle-700 hover:text-periwinkle-900 inline-flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 flex-1">
            {shipmentsLoading ? (
              <LoadingSkeleton type="card" count={2} />
            ) : incomingAwaitingReceipt.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No shipments awaiting receipt"
                description="All dispatched consignments assigned to your facility have been received."
                className="border-0 shadow-none py-6"
              />
            ) : (
              <div className="space-y-3">
                {incomingAwaitingReceipt.map((shipment) => (
                  <div
                    key={shipment.public_id}
                    className="p-4 rounded-xl border border-ivory-300 bg-ivory-50/60 hover:bg-ivory-100/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/shipments/${shipment.public_id || shipment.id}`}
                          state={{ shipment }}
                          className="font-mono text-xs font-bold text-charcoal-900 hover:text-periwinkle-700"
                        >
                          {shipment.shipment_code}
                        </Link>
                        <StatusBadge status={shipment.status} />
                      </div>
                      <p className="text-xs text-charcoal-600">
                        Source:{' '}
                        <span className="font-medium text-charcoal-800">
                          {shipment.warehouse_name ||
                            shipment.warehouse_code ||
                            `Intake #${shipment.intake_id}`}
                        </span>{' '}
                        · Pickups: <span className="font-medium">{shipment.pickup_count ?? 0}</span>
                      </p>
                      <p className="text-[11px] text-charcoal-500">
                        Dispatched: {formatDateTime(shipment.dispatched_at)} · Expected:{' '}
                        <strong className="text-charcoal-800">
                          {formatWeight(shipment.expected_weight_kg)}
                        </strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <Link
                        to={`/shipments/${shipment.public_id || shipment.id}`}
                        state={{ shipment }}
                        className="px-2.5 py-1.5 rounded-lg border border-ivory-300 bg-white hover:bg-ivory-100 text-xs font-medium text-charcoal-700 inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </Link>
                      <Link
                        to={`/receive?shipmentId=${shipment.public_id || shipment.id}`}
                        className="px-3 py-1.5 rounded-lg bg-periwinkle hover:bg-periwinkle-400 text-charcoal-900 text-xs font-bold inline-flex items-center gap-1 shadow-xs"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>Receive</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Recent Shipments */}
        <section className="bg-white rounded-xl border border-ivory-300 shadow-subtle flex flex-col">
          <div className="px-5 py-4 border-b border-ivory-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-charcoal-600" />
              <h2 className="text-sm font-bold text-charcoal-900">Recent Shipments</h2>
            </div>
            <Link
              to="/shipments"
              className="text-xs font-semibold text-periwinkle-700 hover:text-periwinkle-900 inline-flex items-center gap-1"
            >
              <span>All shipments</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 flex-1">
            {shipmentsLoading ? (
              <LoadingSkeleton type="card" count={2} />
            ) : recentShipments.length === 0 ? (
              <EmptyState
                title="No shipments assigned yet"
                description="Incoming disposal shipments dispatched to your facility will appear here."
                className="border-0 shadow-none py-6"
              />
            ) : (
              <div className="divide-y divide-ivory-200">
                {recentShipments.map((shipment) => (
                  <div
                    key={shipment.public_id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/shipments/${shipment.public_id || shipment.id}`}
                          state={{ shipment }}
                          className="font-mono text-xs font-bold text-charcoal-900 hover:text-periwinkle-700"
                        >
                          {shipment.shipment_code}
                        </Link>
                        <StatusBadge status={shipment.status} />
                      </div>
                      <p className="text-xs text-charcoal-500 mt-0.5">
                        {shipment.warehouse_name || `Intake #${shipment.intake_id}`} · Expected:{' '}
                        {formatWeight(shipment.expected_weight_kg)}
                        {shipment.received_weight_kg !== null &&
                        shipment.received_weight_kg !== undefined
                          ? ` · Received: ${formatWeight(shipment.received_weight_kg)}`
                          : ''}
                      </p>
                    </div>

                    <Link
                      to={`/shipments/${shipment.public_id || shipment.id}`}
                      state={{ shipment }}
                      className="px-2.5 py-1.5 rounded-lg border border-ivory-300 bg-ivory-50 hover:bg-ivory-100 text-xs font-semibold text-charcoal-800 inline-flex items-center gap-1 flex-shrink-0"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 4. Recent Disposal Activities & Certificate Status */}
      <section className="bg-white rounded-xl border border-ivory-300 shadow-subtle overflow-hidden">
        <div className="px-5 py-4 border-b border-ivory-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-600" />
            <div>
              <h2 className="text-sm font-bold text-charcoal-900">
                Recent Disposal Activities &amp; Certifications
              </h2>
              <p className="text-xs text-charcoal-500">
                Track received consignments through final disposal and destruction certificate
                issuance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/disposal"
              className="text-xs font-semibold text-charcoal-700 hover:text-charcoal-900 underline"
            >
              Disposal Management
            </Link>
            <Link
              to="/certificates"
              className="text-xs font-semibold text-periwinkle-700 hover:text-periwinkle-900 inline-flex items-center gap-1"
            >
              <span>Certificate Registry</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          {shipmentsLoading || certsLoading ? (
            <div className="p-6">
              <LoadingSkeleton type="card" count={2} />
            </div>
          ) : recentDisposalActivities.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Flame}
                title="No disposal activities recorded yet"
                description="Once shipments are received at your facility, disposal records and certificates will be listed here."
                className="border-0 shadow-none py-4"
              />
            </div>
          ) : (
            <table className="w-full text-left text-sm text-charcoal">
              <thead className="bg-ivory-100/70 border-b border-ivory-200 text-xs font-semibold text-charcoal-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Shipment Code</th>
                  <th className="py-3 px-4">Source Warehouse</th>
                  <th className="py-3 px-4">Received Weight</th>
                  <th className="py-3 px-4">Received At</th>
                  <th className="py-3 px-4">Disposal Status</th>
                  <th className="py-3 px-4">Certificate</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200 text-xs">
                {recentDisposalActivities.map((shipment) => {
                  const cert =
                    shipment.certificate_info || certByShipmentPublicId.get(shipment.public_id);
                  return (
                    <tr key={shipment.public_id} className="hover:bg-ivory-50/70">
                      <td className="py-3.5 px-4 font-mono font-bold text-charcoal-900">
                        <Link
                          to={`/shipments/${shipment.public_id}`}
                          className="hover:text-periwinkle-700"
                        >
                          {shipment.shipment_code}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-charcoal-700">
                        {shipment.warehouse_name ||
                          shipment.warehouse_code ||
                          `Intake #${shipment.intake_id}`}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-charcoal-900">
                        {formatWeight(shipment.received_weight_kg ?? shipment.expected_weight_kg)}
                      </td>
                      <td className="py-3.5 px-4 text-charcoal-500">
                        {formatDateTime(shipment.received_at)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={shipment.status} />
                      </td>
                      <td className="py-3.5 px-4">
                        {cert ? (
                          <div>
                            <span className="font-mono font-semibold text-emerald-800 block">
                              {cert.certificate_number}
                            </span>
                            <span className="text-[11px] text-charcoal-400">
                              {cert.file_name} · {formatDate(cert.issued_at)}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Pending Upload
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {shipment.status !== 'DISPOSED' && (
                            <Link
                              to={`/disposal?shipmentId=${shipment.public_id}`}
                              className="px-2.5 py-1 rounded-lg border border-ivory-300 bg-white hover:bg-ivory-100 font-semibold text-charcoal-800 inline-flex items-center gap-1"
                            >
                              <Flame className="w-3.5 h-3.5 text-amber-600" />
                              <span>Manage Disposal</span>
                            </Link>
                          )}
                          {cert ? (
                            <button
                              onClick={() => handleDownloadCertificate(shipment.public_id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold inline-flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>View PDF</span>
                            </button>
                          ) : (
                            <Link
                              to={`/certificates?shipmentId=${shipment.public_id}`}
                              className="px-2.5 py-1 rounded-lg bg-periwinkle hover:bg-periwinkle-400 text-charcoal-900 font-bold inline-flex items-center gap-1"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload Cert</span>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

