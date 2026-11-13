import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  RotateCw,
  Eye,
  Truck,
  ChevronRight,
  ArrowLeft,
  UserCheck,
  CalendarClock,
  Ban,
  Activity,
  Columns,
  Table as TableIcon,
  X,
} from 'lucide-react';
import { pickupsApi, fleetApi } from '../api/operations';
import {
  PickupMonitoringItem,
  PickupStatus,
  CustomerType,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Modal } from '../components/common/Modal';
import { formatDate, formatDateTime, formatWeight, formatCurrency } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { useLivePickup } from '../hooks/useLivePickup';
import { LiveProgressTimeline } from '../components/monitoring/LiveProgressTimeline';
import { LiveDriverMap } from '../components/monitoring/LiveDriverMap';
import { PickupDetailPanels } from '../components/monitoring/PickupDetailPanels';
import { PickupActivityLog } from '../components/monitoring/PickupActivityLog';
import { ReassignDriverModal } from '../components/monitoring/ReassignDriverModal';

export const PickupMonitoring: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // View Mode: 'SPLIT' (Master-Detail Control Tower) or 'TABLE' (Full Data Table)
  const [viewMode, setViewMode] = useState<'SPLIT' | 'TABLE'>('SPLIT');

  // Selected pickup from query param or local selection
  const selectedParam = searchParams.get('pickup') || searchParams.get('id');
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(selectedParam);

  // Filters state
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('ALL');
  const [driverIdFilter, setDriverIdFilter] = useState<number | ''>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [delayedOnly, setDelayedOnly] = useState<boolean>(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);

  // Admin Actions Modals
  const [showReassignModal, setShowReassignModal] = useState<boolean>(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState<boolean>(false);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync selected pickup ID to search params
  useEffect(() => {
    if (selectedPickupId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('pickup', selectedPickupId);
        return next;
      });
    } else {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('pickup');
        next.delete('id');
        return next;
      });
    }
  }, [selectedPickupId, setSearchParams]);

  // Query: Drivers list for driver filter
  const { data: drivers = [] } = useQuery({
    queryKey: ['adminDriversList'],
    queryFn: () => fleetApi.listDrivers(0, 100),
  });

  // Query: Pickups list with backend pagination and filters
  const {
    data: listData,
    isLoading: isListLoading,
    error: listError,
    refetch: refetchList,
    isFetching: isListFetching,
  } = useQuery({
    queryKey: [
      'adminPickupMonitoringList',
      page,
      pageSize,
      search,
      statusFilter,
      customerTypeFilter,
      driverIdFilter,
      startDate,
      endDate,
      delayedOnly,
    ],
    queryFn: () =>
      pickupsApi.getMonitoring({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        customer_type: customerTypeFilter !== 'ALL' ? customerTypeFilter : undefined,
        driver_id: driverIdFilter ? Number(driverIdFilter) : undefined,
        start_date: startDate ? new Date(startDate + 'T00:00:00Z').toISOString() : undefined,
        end_date: endDate ? new Date(endDate + 'T23:59:59Z').toISOString() : undefined,
        delayed_only: delayedOnly,
      }),
    // Adaptive 30s list polling, paused when tab is in background or manually disabled
    refetchInterval: autoRefreshEnabled ? 30000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Auto-select first pickup in Split mode if none selected
  useEffect(() => {
    if (viewMode === 'SPLIT' && !selectedPickupId && listData?.items && listData.items.length > 0) {
      const first = listData.items[0];
      setSelectedPickupId(first.public_id || String(first.id));
    }
  }, [viewMode, selectedPickupId, listData?.items]);

  // Live Pickup Hook for the Selected Pickup
  const {
    data: selectedDetail,
    isLoading: isDetailLoading,
    isError: isDetailError,
    error: detailError,
    isLiveConnected,
    lastUpdated,
    isStale,
    isTerminal,
    refetch: refetchDetail,
  } = useLivePickup(selectedPickupId);

  // Mutations for Admin Actions
  const reassignMutation = useMutation({
    mutationFn: ({ driverId, vehicleId, reason }: { driverId: number; vehicleId: number | null; reason: string }) =>
      pickupsApi.reassignDriver(selectedPickupId!, { driver_id: driverId, vehicle_id: vehicleId, reason }),
    onSuccess: (data) => {
      setActionAlert({ type: 'success', message: 'Driver reassigned successfully.' });
      queryClient.setQueryData(['adminPickupMonitoringDetail', String(selectedPickupId)], data);
      refetchList();
    },
    onError: (err) => {
      setActionAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: (newDate: string) => pickupsApi.schedule(selectedPickupId!, newDate),
    onSuccess: () => {
      setActionAlert({ type: 'success', message: 'Pickup rescheduled successfully.' });
      refetchDetail();
      refetchList();
      setShowRescheduleModal(false);
    },
    onError: (err) => {
      setActionAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => pickupsApi.cancel(selectedPickupId!, reason),
    onSuccess: () => {
      setActionAlert({ type: 'success', message: 'Pickup cancelled successfully.' });
      refetchDetail();
      refetchList();
      setShowCancelModal(false);
    },
    onError: (err) => {
      setActionAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  // Table Columns Definition
  const columns: Column<PickupMonitoringItem>[] = useMemo(
    () => [
      {
        key: 'pickup_code',
        header: 'Pickup ID',
        sortable: true,
        render: (item: PickupMonitoringItem) => (
          <div className="flex flex-col">
            <span className="font-mono font-bold text-[#201E1C] hover:text-[#7B91EE] transition-colors">
              {item.pickup_code}
            </span>
            <span className="text-[10px] text-[#201E1C]/50">{formatDate(item.created_at)}</span>
          </div>
        ),
      },
      {
        key: 'customer_name',
        header: 'Customer / Facility',
        sortable: true,
        render: (item: PickupMonitoringItem) => (
          <div className="flex flex-col max-w-[200px]">
            <span className="font-semibold text-[#201E1C] truncate">{item.customer_name || 'N/A'}</span>
            <div className="flex items-center gap-1.5 text-[11px] text-[#201E1C]/60 truncate">
              {item.customer_type && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#EADFD0]/40 text-[#201E1C]/70 uppercase">
                  {item.customer_type}
                </span>
              )}
              <span className="truncate">{item.location_name || item.location_address || 'Registered Location'}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'scheduled_date',
        header: 'Schedule',
        sortable: true,
        render: (item: PickupMonitoringItem) => (
          <div className="flex flex-col text-xs">
            {item.scheduled_date ? (
              <>
                <span className="font-semibold text-[#201E1C]">{formatDate(item.scheduled_date)}</span>
                <span className="text-[10px] text-[#201E1C]/50">
                  {new Date(item.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            ) : (
              <span className="text-[#201E1C]/40 italic">Unscheduled</span>
            )}
          </div>
        ),
      },
      {
        key: 'driver_name',
        header: 'Assigned Driver',
        render: (item: PickupMonitoringItem) => (
          <div className="flex flex-col text-xs">
            {item.driver_name ? (
              <>
                <span className="font-bold text-[#201E1C]">{item.driver_name}</span>
                <span className="text-[10px] text-[#201E1C]/50 font-mono">
                  {item.route_code || 'Direct Route'}
                </span>
              </>
            ) : (
              <span className="text-[#201E1C]/40 italic">Unassigned</span>
            )}
          </div>
        ),
      },
      {
        key: 'current_stage',
        header: 'Live Stage',
        render: (item: PickupMonitoringItem) => (
          <div className="flex flex-col gap-1 items-start">
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                item.status === 'COLLECTED'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : item.status === 'FAILED' || item.status === 'CANCELLED'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : item.status === 'IN_PROGRESS'
                  ? 'bg-[#E5EBFF] text-[#201E1C] border-[#7B91EE]/40'
                  : 'bg-[#FDFBF8] text-[#201E1C]/70 border-[#EADFD0]'
              }`}
            >
              {item.current_stage || item.status}
            </span>
            <div className="flex items-center gap-1.5 w-full">
              <div className="w-16 bg-[#EADFD0]/40 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full ${
                    item.status === 'COLLECTED'
                      ? 'bg-emerald-600'
                      : item.status === 'FAILED' || item.status === 'CANCELLED'
                      ? 'bg-red-500'
                      : 'bg-[#7B91EE]'
                  }`}
                  style={{ width: `${item.progress_percent}%` }}
                />
              </div>
              <span className="text-[10px] text-[#201E1C]/50">{item.progress_percent}%</span>
            </div>
          </div>
        ),
      },
      {
        key: 'payment_status',
        header: 'Payment',
        render: (item: PickupMonitoringItem) => (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              item.payment_status === 'PAID'
                ? 'bg-emerald-100 text-emerald-900'
                : item.payment_status === 'FAILED'
                ? 'bg-red-100 text-red-900'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {item.payment_status}
          </span>
        ),
      },
      {
        key: 'is_delayed',
        header: 'Alerts',
        render: (item: PickupMonitoringItem) => (
          <div>
            {item.is_delayed ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                title={item.delay_reasons.join('\n')}
              >
                <AlertTriangle className="w-3 h-3 text-amber-700" />
                Delayed ({item.delay_reasons.length})
              </span>
            ) : item.has_exceptions ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800">
                Notice
              </span>
            ) : (
              <span className="text-[10px] text-emerald-700 font-semibold">Normal</span>
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (item: PickupMonitoringItem) => (
          <button
            onClick={() => {
              setSelectedPickupId(item.public_id || String(item.id));
              setViewMode('SPLIT');
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#E5EBFF] text-[#201E1C] hover:bg-[#7B91EE] hover:text-white transition-colors flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            Track
          </button>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Top Header & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#EADFD0] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-[#201E1C]/50 uppercase tracking-widest mb-0.5">
            <span>Operations</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-[#7B91EE]">Live Telemetry</span>
          </div>
          <h1 className="text-xl font-black text-[#201E1C] tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#7B91EE]" />
            Live Pickup Tracking & Monitoring
          </h1>
        </div>

        {/* View Switcher & Global Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="inline-flex p-1 rounded-xl bg-[#FDFBF8] border border-[#EADFD0]">
            <button
              onClick={() => setViewMode('SPLIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'SPLIT'
                  ? 'bg-[#201E1C] text-white shadow-2xs'
                  : 'text-[#201E1C]/70 hover:text-[#201E1C]'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Split Monitor
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'TABLE'
                  ? 'bg-[#201E1C] text-white shadow-2xs'
                  : 'text-[#201E1C]/70 hover:text-[#201E1C]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              All Pickups Table
            </button>
          </div>

          {/* Auto-Refresh Toggle Button */}
          <button
            onClick={() => setAutoRefreshEnabled((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              autoRefreshEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-[#EADFD0] bg-[#FDFBF8] text-[#201E1C]/60 hover:bg-gray-100'
            }`}
            title={
              autoRefreshEnabled
                ? 'Auto-refresh active (30s interval, pauses when tab is in background). Click to pause.'
                : 'Auto-refresh paused. Click to resume.'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefreshEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            <span>{autoRefreshEnabled ? 'Live Sync (30s)' : 'Sync Paused'}</span>
          </button>

          {/* Quick Refresh */}
          <button
            onClick={() => {
              refetchList();
              if (selectedPickupId) refetchDetail();
            }}
            disabled={isListFetching}
            className="px-3 py-2 rounded-xl border border-[#EADFD0] bg-white text-xs font-bold text-[#201E1C] hover:bg-gray-50 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh All Data Now"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isListFetching ? 'animate-spin text-[#7B91EE]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Interactive KPI Counters Strip */}
      {listData?.summary_counts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {[
            { label: 'Total', count: listData.summary_counts.total, key: 'ALL', color: 'text-[#201E1C]' },
            { label: 'Requested', count: listData.summary_counts.requested, key: 'REQUESTED', color: 'text-[#7B91EE]' },
            { label: 'Scheduled', count: listData.summary_counts.scheduled, key: 'SCHEDULED', color: 'text-[#201E1C]' },
            { label: 'In Progress', count: listData.summary_counts.in_progress, key: 'IN_PROGRESS', color: 'text-amber-700' },
            { label: 'Completed', count: listData.summary_counts.completed, key: 'COLLECTED', color: 'text-emerald-700' },
            { label: 'Delayed / Alert', count: listData.summary_counts.delayed, key: 'DELAYED', color: 'text-amber-600' },
            {
              label: 'Cancelled/Failed',
              count: listData.summary_counts.cancelled + listData.summary_counts.failed,
              key: 'CANCELLED',
              color: 'text-red-600',
            },
          ].map((kpi) => {
            const isActive =
              kpi.key === 'DELAYED'
                ? delayedOnly
                : statusFilter === kpi.key && !delayedOnly;

            return (
              <div
                key={kpi.label}
                onClick={() => {
                  if (kpi.key === 'DELAYED') {
                    setDelayedOnly(!delayedOnly);
                    setStatusFilter('ALL');
                  } else {
                    setStatusFilter(statusFilter === kpi.key ? 'ALL' : kpi.key);
                    setDelayedOnly(false);
                  }
                  setPage(1);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'border-[#7B91EE] bg-[#E5EBFF]/40 shadow-xs ring-2 ring-[#7B91EE]'
                    : 'border-[#EADFD0] bg-white hover:border-[#7B91EE]/60 hover:shadow-2xs'
                }`}
              >
                <span className="text-[10px] text-[#201E1C]/50 uppercase font-bold block truncate">{kpi.label}</span>
                <span className={`text-lg font-black ${kpi.color}`}>{kpi.count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Notification Alert */}
      {actionAlert && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionAlert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{actionAlert.message}</span>
          <button onClick={() => setActionAlert(null)} className="text-[#201E1C]/60 hover:text-[#201E1C]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW MODE 1: SPLIT MASTER-DETAIL WORKSPACE (ZERO SCROLL)   */}
      {/* ========================================================= */}
      {viewMode === 'SPLIT' && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* LEFT MASTER COLUMN: Compact Scrollable Pickups Queue */}
          <div className="w-full lg:w-[360px] xl:w-[400px] shrink-0 bg-white rounded-2xl border border-[#EADFD0] p-3.5 flex flex-col h-[calc(100vh-235px)] shadow-2xs">
            {/* Queue Header & Search */}
            <div className="space-y-2 pb-2.5 border-b border-[#EADFD0]/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#201E1C] uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-[#7B91EE]" />
                  Pickups Queue ({listData?.total || 0})
                </span>
                {isListFetching && <RotateCw className="w-3 h-3 text-[#7B91EE] animate-spin" />}
              </div>

              {/* Compact Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#201E1C]/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search code, facility, driver..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-[#EADFD0] bg-[#FDFBF8] focus:outline-hidden focus:ring-1 focus:ring-[#7B91EE]"
                />
              </div>

              {/* Quick Status Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
                {['ALL', 'SCHEDULED', 'IN_PROGRESS', 'COLLECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setDelayedOnly(false);
                      setPage(1);
                    }}
                    className={`px-2 py-0.5 rounded-lg font-bold shrink-0 transition-colors ${
                      statusFilter === st && !delayedOnly
                        ? 'bg-[#201E1C] text-white'
                        : 'bg-gray-100 text-[#201E1C]/70 hover:bg-gray-200'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st === 'IN_PROGRESS' ? 'Active' : st === 'COLLECTED' ? 'Done' : 'Scheduled'}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setDelayedOnly(!delayedOnly);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 rounded-lg font-bold shrink-0 transition-colors ${
                    delayedOnly
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  Alerts
                </button>
              </div>
            </div>

            {/* Scrollable Pickups Queue */}
            <div className="flex-1 overflow-y-auto space-y-2 pt-2.5 pr-1">
              {isListLoading ? (
                <LoadingSkeleton type="card" count={4} />
              ) : listData?.items.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#201E1C]/50">
                  No pickups match your active filter.
                </div>
              ) : (
                listData?.items.map((item) => {
                  const isSelected = selectedPickupId === (item.public_id || String(item.id));
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedPickupId(item.public_id || String(item.id))}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#7B91EE] bg-[#E5EBFF]/40 shadow-xs ring-1 ring-[#7B91EE]'
                          : 'border-[#EADFD0]/80 bg-[#FDFBF8] hover:bg-white hover:border-[#7B91EE]/50 hover:shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono text-xs font-bold text-[#201E1C]">
                          {item.pickup_code}
                        </span>
                        <span
                          className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase ${
                            item.status === 'COLLECTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'FAILED' || item.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-800'
                              : item.status === 'IN_PROGRESS'
                              ? 'bg-[#E5EBFF] text-[#201E1C]'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-[#201E1C] truncate">
                        {item.customer_name || 'Customer'}
                      </div>
                      <div className="text-[10px] text-[#201E1C]/60 truncate">
                        {item.location_name || item.location_address || 'Facility Location'}
                      </div>

                      <div className="flex items-center justify-between gap-1 text-[10px] text-[#201E1C]/50 mt-2 pt-1.5 border-t border-[#EADFD0]/40">
                        <span className="truncate">
                          {item.driver_name ? `Driver: ${item.driver_name}` : 'Unassigned'}
                        </span>
                        {item.is_delayed && (
                          <span className="text-amber-700 font-bold flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Delay
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls in Queue Footer */}
            {listData && listData.total_pages > 1 && (
              <div className="pt-2.5 border-t border-[#EADFD0]/60 flex items-center justify-between text-[11px] text-[#201E1C]/60">
                <span>
                  Page {listData.page} of {listData.total_pages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-2 py-0.5 rounded border border-[#EADFD0] bg-white disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(listData.total_pages, p + 1))}
                    disabled={page >= listData.total_pages}
                    className="px-2 py-0.5 rounded border border-[#EADFD0] bg-white disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT DETAIL COLUMN: Selected Pickup Live Command Center */}
          <div className="flex-1 min-w-0 w-full bg-[#FDFBF8] border border-[#EADFD0] rounded-2xl p-4 sm:p-5 shadow-2xs h-[calc(100vh-235px)] overflow-y-auto space-y-5">
            {selectedPickupId ? (
              <>
                {/* Detail Sticky Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-[#EADFD0]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#7B91EE] bg-[#E5EBFF] px-2 py-0.5 rounded">
                        {selectedDetail?.pickup_code || selectedPickupId}
                      </span>
                      {selectedDetail && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                            selectedDetail.status === 'COLLECTED'
                              ? 'bg-emerald-100 text-emerald-900'
                              : selectedDetail.status === 'FAILED' || selectedDetail.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-900'
                              : 'bg-[#E5EBFF] text-[#201E1C]'
                          }`}
                        >
                          {selectedDetail.status}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-black text-[#201E1C] mt-1">
                      {selectedDetail?.customer.display_name || 'Loading Pickup Record...'}
                    </h2>
                    <p className="text-xs text-[#201E1C]/60 truncate">
                      {selectedDetail?.customer.address || 'Checking customer facility coordinates...'}
                    </p>
                  </div>

                  {/* Telemetry Status & Authorized Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Live Stream / Event-driven Telemetry indicator */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#EADFD0] bg-white text-xs font-semibold text-[#201E1C]">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isTerminal
                            ? 'bg-emerald-600'
                            : isLiveConnected
                            ? 'bg-emerald-500 animate-pulse'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span>
                        {isTerminal
                          ? 'Completed (Archived)'
                          : isLiveConnected
                          ? 'Event-Driven Live'
                          : 'Fallback Polling'}
                      </span>
                      {lastUpdated && (
                        <span className="text-[10px] text-[#201E1C]/50 border-l border-[#EADFD0] pl-2">
                          {lastUpdated.toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    {isStale && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold">
                        Data Stale
                      </span>
                    )}

                    {/* Admin Actions */}
                    <button
                      onClick={() => setShowReassignModal(true)}
                      className="px-3 py-1.5 rounded-lg border border-[#EADFD0] bg-white hover:bg-gray-50 text-xs font-bold text-[#201E1C] flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-[#7B91EE]" />
                      Reassign
                    </button>

                    <button
                      onClick={() => setShowRescheduleModal(true)}
                      className="px-3 py-1.5 rounded-lg border border-[#EADFD0] bg-white hover:bg-gray-50 text-xs font-bold text-[#201E1C] flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <CalendarClock className="w-3.5 h-3.5 text-[#7B91EE]" />
                      Reschedule
                    </button>

                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-800 flex items-center gap-1.5 transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5 text-red-600" />
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Loading / Error States */}
                {isDetailLoading && !selectedDetail && <LoadingSkeleton type="card" count={3} />}
                {isDetailError && !selectedDetail && (
                  <ErrorState
                    title="Failed to load pickup telemetry"
                    message={getErrorMessage(detailError)}
                    onRetry={refetchDetail}
                  />
                )}

                {selectedDetail && (
                  <>
                    {/* 1. Live Progress Timeline */}
                    <LiveProgressTimeline
                      stages={selectedDetail.timeline}
                      progressPercent={selectedDetail.progress_percent}
                      currentStageName={selectedDetail.current_stage_name}
                      isDelayed={selectedDetail.is_delayed}
                      delayReasons={selectedDetail.delay_reasons}
                    />

                    {/* 2. Driver Live GPS Telemetry and Map */}
                    <LiveDriverMap
                      driver={selectedDetail.driver}
                      customer={selectedDetail.customer}
                      routeCode={selectedDetail.route_code}
                      onRefreshLocation={refetchDetail}
                      isRefreshing={isDetailLoading}
                    />

                    {/* 3. Comprehensive Information Panels */}
                    <PickupDetailPanels detail={selectedDetail} />

                    {/* 4. Complete Activity and Audit Log */}
                    <PickupActivityLog events={selectedDetail.events} />
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-[#201E1C]/60 space-y-3">
                <Truck className="w-12 h-12 text-[#7B91EE]/50 animate-bounce" />
                <h3 className="text-base font-bold text-[#201E1C]">No Pickup Selected</h3>
                <p className="text-xs max-w-sm">
                  Select a pickup from the left queue to view live progress, driver location map, collection weight, and activity logs.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW MODE 2: FULL DATA TABLE VIEW                         */}
      {/* ========================================================= */}
      {viewMode === 'TABLE' && (
        <div className="bg-white rounded-2xl border border-[#EADFD0] p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#201E1C]">All Monitored Pickups</h3>
              <p className="text-xs text-[#201E1C]/60">
                Comprehensive data table with multi-attribute filtering, sorting, and pagination.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#201E1C]/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search ID, customer, or driver..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#EADFD0] bg-[#FDFBF8] focus:outline-hidden focus:ring-2 focus:ring-[#7B91EE]"
              />
            </div>
          </div>

          {/* Filter Controls Bar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#EADFD0]/40 text-xs">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg border border-[#EADFD0] bg-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#7B91EE]"
            >
              <option value="ALL">All Statuses</option>
              <option value="REQUESTED">Requested</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="ASSIGNED">Driver Assigned</option>
              <option value="IN_PROGRESS">In Progress / En Route</option>
              <option value="COLLECTED">Completed / Collected</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="FAILED">Failed</option>
            </select>

            {/* Customer Type Filter */}
            <select
              value={customerTypeFilter}
              onChange={(e) => {
                setCustomerTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg border border-[#EADFD0] bg-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#7B91EE]"
            >
              <option value="ALL">All Facility Types</option>
              <option value="PHARMACY">Pharmacy</option>
              <option value="DISTRIBUTOR">Distributor</option>
              <option value="HOSPITAL">Hospital</option>
              <option value="CLINIC">Clinic</option>
            </select>

            {/* Driver Filter */}
            <select
              value={driverIdFilter}
              onChange={(e) => {
                setDriverIdFilter(e.target.value ? Number(e.target.value) : '');
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg border border-[#EADFD0] bg-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#7B91EE]"
            >
              <option value="">All Drivers</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.employee_id} ({d.phone})
                </option>
              ))}
            </select>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-1.5 bg-[#FDFBF8] px-2 py-1 rounded-lg border border-[#EADFD0]">
              <Calendar className="w-3.5 h-3.5 text-[#201E1C]/40" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs text-[#201E1C] focus:outline-hidden"
                title="Start date"
              />
              <span className="text-[#201E1C]/40">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs text-[#201E1C] focus:outline-hidden"
                title="End date"
              />
            </div>

            {/* Attention Required / Delayed Toggle */}
            <button
              onClick={() => {
                setDelayedOnly(!delayedOnly);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-colors flex items-center gap-1.5 ${
                delayedOnly
                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                  : 'bg-white text-[#201E1C]/70 border-[#EADFD0] hover:bg-gray-50'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${delayedOnly ? 'text-amber-700' : 'text-[#201E1C]/40'}`} />
              Delayed Only
            </button>

            {(search || statusFilter !== 'ALL' || customerTypeFilter !== 'ALL' || driverIdFilter || startDate || endDate || delayedOnly) && (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setCustomerTypeFilter('ALL');
                  setDriverIdFilter('');
                  setStartDate('');
                  setEndDate('');
                  setDelayedOnly(false);
                  setPage(1);
                }}
                className="text-xs text-[#7B91EE] font-bold hover:underline ml-auto"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Pickups Table */}
          {isListLoading ? (
            <LoadingSkeleton type="table-row" count={5} />
          ) : listError ? (
            <ErrorState
              title="Failed to load pickups"
              message={getErrorMessage(listError)}
              onRetry={refetchList}
            />
          ) : (
            <div className="overflow-hidden">
              <DataTable
                data={listData?.items || []}
                columns={columns}
                isLoading={isListLoading}
                emptyTitle="No monitored pickups found"
                emptyDescription="No pickups match the active monitoring filter criteria."
              />
              {listData && listData.total > 0 && (
                <div className="px-4 py-3 border-t border-[#EADFD0] flex items-center justify-between text-xs text-[#201E1C]/60">
                  <div>
                    Showing {(listData.page - 1) * listData.page_size + 1} to{' '}
                    {Math.min(listData.page * listData.page_size, listData.total)} of {listData.total} pickups
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1 rounded-lg border border-[#EADFD0] bg-white text-xs font-bold disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-semibold">
                      Page {listData.page} of {listData.total_pages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(listData.total_pages, p + 1))}
                      disabled={page >= listData.total_pages}
                      className="px-3 py-1 rounded-lg border border-[#EADFD0] bg-white text-xs font-bold disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reassign Driver Modal */}
      {showReassignModal && selectedDetail && (
        <ReassignDriverModal
          isOpen={showReassignModal}
          onClose={() => setShowReassignModal(false)}
          pickupCode={selectedDetail.pickup_code}
          currentDriverName={selectedDetail.driver?.name}
          onConfirm={async (driverId, vehicleId, reason) => {
            await reassignMutation.mutateAsync({ driverId, vehicleId, reason });
          }}
          isLoading={reassignMutation.isPending}
        />
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedDetail && (
        <Modal
          isOpen={showRescheduleModal}
          onClose={() => setShowRescheduleModal(false)}
          title={`Reschedule Pickup – ${selectedDetail.pickup_code}`}
          maxWidth="md"
        >
          <div className="p-5 space-y-4 text-xs">
            <p className="text-[#201E1C]/70">
              Select a new operational date and time for pickup collection at {selectedDetail.customer.display_name}.
            </p>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#201E1C]/60 mb-1.5">
                New Scheduled Date & Time *
              </label>
              <input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-[#EADFD0] bg-white text-xs focus:ring-2 focus:ring-[#7B91EE]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#EADFD0]">
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="px-4 py-2 rounded-lg border border-[#EADFD0] font-bold text-[#201E1C] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (rescheduleDate) {
                    rescheduleMutation.mutate(new Date(rescheduleDate).toISOString());
                  }
                }}
                disabled={!rescheduleDate || rescheduleMutation.isPending}
                className="px-4 py-2 rounded-lg bg-[#201E1C] text-white font-bold hover:bg-black disabled:opacity-50"
              >
                {rescheduleMutation.isPending ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelModal && selectedDetail && (
        <Modal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          title={`Cancel Pickup – ${selectedDetail.pickup_code}`}
          maxWidth="md"
        >
          <div className="p-5 space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Cancellation Warning:</span>
                <p className="mt-0.5">
                  This will mark pickup {selectedDetail.pickup_code} as cancelled and notify the customer and assigned fleet.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#201E1C]/60 mb-1.5">
                Cancellation Reason *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                required
                placeholder="Enter regulatory or operational reason for cancellation..."
                className="w-full px-3 py-2 rounded-lg border border-[#EADFD0] bg-white text-xs focus:ring-2 focus:ring-[#7B91EE]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#EADFD0]">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-lg border border-[#EADFD0] font-bold text-[#201E1C] hover:bg-gray-50"
              >
                Keep Pickup
              </button>
              <button
                onClick={() => {
                  if (cancelReason.trim()) {
                    cancelMutation.mutate(cancelReason.trim());
                  }
                }}
                disabled={!cancelReason.trim() || cancelMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
