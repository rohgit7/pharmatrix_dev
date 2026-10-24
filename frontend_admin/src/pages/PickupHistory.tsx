import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { pickupsApi, customersApi } from '../api/operations';
import {
  PickupHistoryItem,
  PickupStatus,
  CustomerResponse,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { ErrorState } from '../components/common/ErrorState';
import { Modal } from '../components/common/Modal';
import { formatDate, formatWeight } from '../utils/formatters';
import {
  History,
  Search,
  Filter,
  Calendar,
  Eye,
  ArrowLeft,
  Truck,
  Building2,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Scale,
  FileText,
  User,
} from 'lucide-react';

export const PickupHistory: React.FC = () => {
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<PickupStatus | ''>('');
  const [customerIdFilter, setCustomerIdFilter] = useState<number | ''>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [selectedPickup, setSelectedPickup] = useState<PickupHistoryItem | null>(null);

  // Queries
  const { data: customers = [] } = useQuery({
    queryKey: ['adminCustomers'],
    queryFn: () => customersApi.list(),
  });

  const {
    data: historyData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'adminPickupHistory',
      page,
      pageSize,
      statusFilter,
      customerIdFilter,
      startDate,
      endDate,
      search,
    ],
    queryFn: () =>
      pickupsApi.getHistory({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        customer_id: customerIdFilter ? Number(customerIdFilter) : undefined,
        start_date: startDate ? new Date(startDate + 'T00:00:00Z').toISOString() : undefined,
        end_date: endDate ? new Date(endDate + 'T23:59:59Z').toISOString() : undefined,
        search: search.trim() || undefined,
      }),
  });

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCustomerIdFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const columns: Column<PickupHistoryItem>[] = [
    {
      key: 'pickup_code',
      header: 'Pickup Code',
      sortable: true,
      render: (item) => (
        <div>
          <button
            onClick={() => setSelectedPickup(item)}
            className="font-mono font-bold text-charcoal-900 hover:text-periwinkle-700 text-left hover:underline"
          >
            {item.pickup_code}
          </button>
          <span className="text-[11px] text-charcoal-500 block">
            {formatDate(item.created_at)}
          </span>
        </div>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer & Facility',
      render: (item) => (
        <div>
          <span className="font-semibold text-charcoal-900 block truncate max-w-xs">
            {item.customer_name || `Customer #${item.customer_id}`}
          </span>
          <span className="text-[11px] text-charcoal-500 flex items-center gap-1 mt-0.5 truncate max-w-xs">
            <MapPin className="w-3 h-3 text-charcoal-400 shrink-0" />
            <span>{item.location_name || item.location_address || `Location #${item.location_id}`}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={item.status} />
          {item.failure_reason && (
            <span className="text-[10px] text-rose-600 truncate max-w-[140px]" title={item.failure_reason}>
              {item.failure_reason}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'estimated_weight_kg',
      header: 'Weight (Est / Act)',
      render: (item) => (
        <div className="text-xs">
          <div className="font-medium text-charcoal-700">
            Est: <span className="font-semibold">{item.estimated_weight_kg ? formatWeight(item.estimated_weight_kg) : '—'}</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold">
            Act: {item.collected_weight_kg ? formatWeight(item.collected_weight_kg) : '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'route_code',
      header: 'Route & Driver',
      render: (item) => (
        <div className="text-xs">
          {item.route_code ? (
            <div className="font-mono text-charcoal-800 font-medium flex items-center gap-1">
              <Truck className="w-3 h-3 text-charcoal-400" />
              <span>{item.route_code}</span>
            </div>
          ) : (
            <span className="text-charcoal-400 italic">No Route</span>
          )}
          {item.driver_name && (
            <span className="text-[11px] text-charcoal-500 block">
              Driver: {item.driver_name}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      className: 'text-right',
      render: (item) => (
        <button
          onClick={() => setSelectedPickup(item)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-ivory-100 text-charcoal-800 hover:bg-ivory-200 border border-ivory-300 transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-charcoal-500" />
          <span>Details</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/pickups"
              className="p-1.5 rounded-lg bg-white border border-ivory-300 text-charcoal-600 hover:text-charcoal-900 transition-colors"
              title="Return to Active Pickup Planning"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl font-bold text-charcoal-900 tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-periwinkle" />
              <span>Pickup Operational History</span>
            </h1>
          </div>
          <p className="text-xs text-charcoal-500 mt-1">
            Historical archive of all completed, collected, failed, and cancelled pickups with audit traceability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/pickups"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-ivory-300 hover:bg-ivory-100 text-charcoal-800 text-xs font-semibold rounded-xl shadow-subtle transition-colors"
          >
            <span>Active Operations Planning</span>
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white rounded-xl border border-ivory-300 shadow-subtle space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-charcoal-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search pickup code or customer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-xs text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-periwinkle"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as PickupStatus | '');
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-periwinkle"
            >
              <option value="">All Statuses</option>
              <option value="COLLECTED">Collected</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div>
            <select
              value={customerIdFilter}
              onChange={(e) => {
                setCustomerIdFilter(e.target.value ? Number(e.target.value) : '');
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-periwinkle"
            >
              <option value="">All Customers</option>
              {customers.map((c: CustomerResponse) => (
                <option key={c.id} value={c.id}>
                  {c.display_name} ({c.customer_type})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-periwinkle"
              placeholder="From Date"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-periwinkle"
              placeholder="To Date"
            />
          </div>
        </div>

        {/* Reset filter button */}
        {(search || statusFilter || customerIdFilter || startDate || endDate) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-xs text-charcoal-500 hover:text-charcoal-900 font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset all filters</span>
            </button>
          </div>
        )}
      </div>

      {/* History Data Table */}
      {error ? (
        <ErrorState
          title="Failed to load pickup history"
          message={error instanceof Error ? error.message : 'An error occurred while fetching history.'}
          onRetry={() => { void refetch(); }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-ivory-300 shadow-subtle overflow-hidden">
          <DataTable
            data={historyData?.items || []}
            columns={columns}
            isLoading={isLoading}
            emptyTitle="No historical records"
            emptyDescription="No historical pickup records match your search or filter criteria."
          />

          {/* Server-Side Pagination Bar */}
          {historyData && historyData.total > 0 && (
            <div className="px-6 py-4 border-t border-ivory-300 flex items-center justify-between text-xs text-charcoal-600">
              <div>
                Showing{' '}
                <span className="font-semibold">
                  {(historyData.page - 1) * historyData.page_size + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold">
                  {Math.min(historyData.page * historyData.page_size, historyData.total)}
                </span>{' '}
                of <span className="font-semibold">{historyData.total}</span> records
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 bg-ivory-100 hover:bg-ivory-200 text-charcoal-800 font-semibold rounded-lg border border-ivory-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="font-medium text-charcoal-700">
                  Page {historyData.page} of {historyData.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(historyData.total_pages, p + 1))}
                  disabled={page >= historyData.total_pages}
                  className="px-3 py-1.5 bg-ivory-100 hover:bg-ivory-200 text-charcoal-800 font-semibold rounded-lg border border-ivory-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pickup Detail Modal */}
      {selectedPickup && (
        <Modal
          isOpen={!!selectedPickup}
          onClose={() => setSelectedPickup(null)}
          title={`Pickup Record — ${selectedPickup.pickup_code}`}
        >
          <div className="space-y-4 text-xs">
            {/* Status and Summary */}
            <div className="p-4 bg-ivory-50 rounded-xl border border-ivory-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-charcoal-400 tracking-wider">
                  Operational Status
                </span>
                <div className="mt-1">
                  <StatusBadge status={selectedPickup.status} />
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-charcoal-400 tracking-wider">
                  Priority
                </span>
                <div className="font-semibold text-charcoal-900 mt-1">
                  {selectedPickup.priority}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-charcoal-400 tracking-wider">
                  Pickup ID
                </span>
                <div className="font-mono text-charcoal-700 mt-1">
                  #{selectedPickup.id}
                </div>
              </div>
            </div>

            {/* Customer & Location */}
            <div className="p-4 bg-white rounded-xl border border-ivory-300 space-y-2">
              <div className="flex items-center gap-2 text-charcoal-900 font-bold">
                <Building2 className="w-4 h-4 text-periwinkle" />
                <span>Customer & Pickup Location</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-charcoal-400">Customer Name:</span>
                  <div className="font-semibold text-charcoal-900">
                    {selectedPickup.customer_name || `Customer #${selectedPickup.customer_id}`}
                  </div>
                </div>
                <div>
                  <span className="text-charcoal-400">Location Name:</span>
                  <div className="font-semibold text-charcoal-900">
                    {selectedPickup.location_name || `Location #${selectedPickup.location_id}`}
                  </div>
                </div>
                {selectedPickup.location_address && (
                  <div className="col-span-2">
                    <span className="text-charcoal-400">Address:</span>
                    <div className="text-charcoal-800">{selectedPickup.location_address}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Weight Breakdown */}
            <div className="p-4 bg-white rounded-xl border border-ivory-300 space-y-2">
              <div className="flex items-center gap-2 text-charcoal-900 font-bold">
                <Scale className="w-4 h-4 text-emerald-600" />
                <span>Weight Verification</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-charcoal-400">Estimated Weight:</span>
                  <div className="font-semibold text-charcoal-900">
                    {selectedPickup.estimated_weight_kg ? formatWeight(selectedPickup.estimated_weight_kg) : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-charcoal-400">Verified Collected Weight:</span>
                  <div className="font-semibold text-emerald-700">
                    {selectedPickup.collected_weight_kg ? formatWeight(selectedPickup.collected_weight_kg) : 'Not collected'}
                  </div>
                </div>
              </div>
            </div>

            {/* Logistics & Route */}
            <div className="p-4 bg-white rounded-xl border border-ivory-300 space-y-2">
              <div className="flex items-center gap-2 text-charcoal-900 font-bold">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>Logistics Execution</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-charcoal-400">Assigned Route:</span>
                  <div className="font-semibold text-charcoal-900">
                    {selectedPickup.route_code || 'None'}
                  </div>
                </div>
                <div>
                  <span className="text-charcoal-400">Assigned Driver:</span>
                  <div className="font-semibold text-charcoal-900">
                    {selectedPickup.driver_name || (selectedPickup.driver_id ? `Driver #${selectedPickup.driver_id}` : 'None')}
                  </div>
                </div>
                <div>
                  <span className="text-charcoal-400">Requested Date:</span>
                  <div className="text-charcoal-800">
                    {selectedPickup.requested_date ? formatDate(selectedPickup.requested_date) : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-charcoal-400">Collection Date:</span>
                  <div className="text-charcoal-800">
                    {selectedPickup.collected_at ? formatDate(selectedPickup.collected_at) : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Exception / Failure details */}
            {selectedPickup.failure_reason && (
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-1">
                <div className="flex items-center gap-2 text-rose-800 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Failure Reason</span>
                </div>
                <p className="text-xs text-rose-700">{selectedPickup.failure_reason}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedPickup(null)}
                className="px-4 py-2 bg-charcoal-900 text-white font-semibold rounded-lg hover:bg-charcoal-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PickupHistory;
