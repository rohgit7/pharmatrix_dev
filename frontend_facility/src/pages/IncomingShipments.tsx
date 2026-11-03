import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Truck,
  Eye,
  Scale,
  Flame,
  FileCheck,
  Warehouse,
  Boxes,
  RefreshCw,
} from 'lucide-react';
import { facilityShipmentsApi } from '../api/facility';
import { DisposalShipment, DisposalShipmentStatus } from '../types/facility';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { ErrorState } from '../components/common/ErrorState';
import { formatDateTime, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';

const STATUS_FILTERS: Array<{ label: string; value: DisposalShipmentStatus | 'ALL' }> = [
  { label: 'All Shipments', value: 'ALL' },
  { label: 'In Transit (Awaiting Receipt)', value: 'IN_TRANSIT' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Discrepancy', value: 'DISCREPANCY' },
  { label: 'Disposed & Certified', value: 'DISPOSED' },
];

export const IncomingShipments: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = (searchParams.get('status') as DisposalShipmentStatus | 'ALL') || 'ALL';

  const [statusFilter, setStatusFilter] = useState<DisposalShipmentStatus | 'ALL'>(initialStatus);

  useEffect(() => {
    const paramStatus = searchParams.get('status') as DisposalShipmentStatus | 'ALL' | null;
    if (paramStatus && paramStatus !== statusFilter) {
      setStatusFilter(paramStatus);
    }
  }, [searchParams]);

  const {
    data: shipments = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['facilityShipments'],
    queryFn: facilityShipmentsApi.list,
    refetchInterval: 15000,
  });

  const filteredShipments = useMemo(() => {
    if (statusFilter === 'ALL') return shipments;
    return shipments.filter((s) => s.status === statusFilter);
  }, [shipments, statusFilter]);

  const handleStatusChange = (status: DisposalShipmentStatus | 'ALL') => {
    setStatusFilter(status);
    if (status === 'ALL') {
      setSearchParams({});
    } else {
      setSearchParams({ status });
    }
  };

  const openShipmentDetails = (row: DisposalShipment, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const targetId = row.public_id || String(row.id);
    navigate(`/shipments/${targetId}`, { state: { shipment: row } });
  };

  const columns: Column<DisposalShipment>[] = [
    {
      key: 'shipment_code',
      header: 'Shipment ID',
      sortable: true,
      render: (row) => (
        <div>
          <button
            type="button"
            onClick={(e) => openShipmentDetails(row, e)}
            className="font-mono font-bold text-xs text-charcoal-900 hover:text-periwinkle-700 hover:underline block text-left"
          >
            {row.shipment_code}
          </button>
          <span className="font-mono text-[10px] text-charcoal-400">
            {row.public_id ? `${String(row.public_id).slice(0, 8)}...` : `#${row.id}`}
          </span>
        </div>
      ),
    },
    {
      key: 'dispatched_at',
      header: 'Dispatch Date',
      sortable: true,
      render: (row) => (
        <div className="text-xs">
          <span className="text-charcoal-800 font-medium block">
            {row.dispatched_at ? formatDateTime(row.dispatched_at) : '—'}
          </span>
          {row.received_at && (
            <span className="text-[11px] text-charcoal-400">
              Received: {formatDateTime(row.received_at)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'warehouse_name',
      header: 'Source Warehouse',
      sortable: true,
      render: (row) => (
        <div className="flex items-start gap-2">
          <Warehouse className="w-3.5 h-3.5 text-charcoal-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-xs font-semibold text-charcoal-800 block">
              {row.warehouse_name || row.warehouse_code || `Warehouse Intake #${row.intake_id}`}
            </span>
            <span className="text-[11px] text-charcoal-500">
              {row.intake_code ? `Intake: ${row.intake_code}` : `Intake #${row.intake_id}`}
              {row.warehouse_city ? ` · ${row.warehouse_city}` : ''}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'pickup_count',
      header: 'Pickups',
      sortable: true,
      render: (row) => (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ivory-100 border border-ivory-300 text-xs font-semibold text-charcoal-800">
          <Boxes className="w-3.5 h-3.5 text-charcoal-500" />
          <span>{row.pickup_count ?? 0}</span>
        </div>
      ),
    },
    {
      key: 'expected_weight_kg',
      header: 'Expected Waste Weight',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-mono text-xs font-bold text-charcoal-900 block">
            {formatWeight(row.expected_weight_kg)}
          </span>
          {row.received_weight_kg !== null && row.received_weight_kg !== undefined && (
            <span className="font-mono text-[11px] text-emerald-700 font-medium">
              Rec: {formatWeight(row.received_weight_kg)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Shipment Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: 'Action',
      className: 'text-right',
      render: (row) => {
        const targetId = row.public_id || String(row.id);
        return (
          <div
            className="flex items-center justify-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => openShipmentDetails(row, e)}
              className="px-2.5 py-1.5 rounded-lg border border-ivory-300 bg-white hover:bg-ivory-100 text-xs font-semibold text-charcoal-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>

            {row.status === 'IN_TRANSIT' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/receive?shipmentId=${targetId}`);
                }}
                className="px-3 py-1.5 rounded-lg bg-periwinkle hover:bg-periwinkle-400 text-charcoal-900 text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Receive</span>
              </button>
            )}

            {(row.status === 'RECEIVED' || row.status === 'DISCREPANCY') && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/disposal?shipmentId=${targetId}`);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Dispose</span>
              </button>
            )}

            {['RECEIVED', 'DISCREPANCY', 'DISPOSED'].includes(row.status) &&
              !row.certificate_info && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/certificates?shipmentId=${targetId}`);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-charcoal-900 hover:bg-charcoal-800 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FileCheck className="w-3.5 h-3.5 text-periwinkle" />
                  <span>Certify</span>
                </button>
              )}
          </div>
        );
      },
    },
  ];

  if (isError) {
    return (
      <ErrorState
        title="Unable to load incoming shipments"
        message={getErrorMessage(error)}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-periwinkle-700" />
            <h1 className="text-xl font-bold text-charcoal-900 tracking-tight">
              Incoming Waste Shipments
            </h1>
          </div>
          <p className="text-xs text-charcoal-500 mt-1">
            View all waste consignments assigned to your facility, inspect chain-of-custody pickup
            manifests, and record shipment receipts.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-ivory-300 bg-white hover:bg-ivory-100 text-xs font-semibold text-charcoal-700 shadow-subtle transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => {
          const count =
            f.value === 'ALL'
              ? shipments.length
              : shipments.filter((s) => s.status === f.value).length;
          const active = statusFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => handleStatusChange(f.value)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 border ${
                active
                  ? 'bg-charcoal-900 text-white border-charcoal-900 shadow-xs'
                  : 'bg-white text-charcoal-600 border-ivory-300 hover:bg-ivory-100 hover:text-charcoal-900'
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  active ? 'bg-periwinkle text-charcoal-900' : 'bg-ivory-200 text-charcoal-700'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Shipments Table */}
      <DataTable
        columns={columns}
        data={filteredShipments}
        isLoading={isLoading}
        searchPlaceholder="Search by Shipment ID (e.g. DS-...), warehouse, or intake code..."
        searchFilter={(row, query) =>
          (row.shipment_code?.toLowerCase().includes(query) ?? false) ||
          (String(row.public_id || '')
            .toLowerCase()
            .includes(query)) ||
          (row.warehouse_name?.toLowerCase().includes(query) ?? false) ||
          (row.warehouse_code?.toLowerCase().includes(query) ?? false) ||
          (row.intake_code?.toLowerCase().includes(query) ?? false)
        }
        onRowClick={(row) => openShipmentDetails(row)}
        emptyTitle="No shipments match the selected filter"
        emptyDescription="Try switching the status filter or searching for a different shipment code."
      />
    </div>
  );
};
