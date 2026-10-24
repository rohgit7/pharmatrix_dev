import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { pickupsApi, customersApi, routesApi, warehousesApi } from '../api/operations';
import {
  PickupAdminResponse,
  PickupAdminCreate,
  PickupAdminUpdate,
  PickupStatus,
  PickupPriority,
  CustomerResponse,
  CustomerLocationResponse,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { ErrorState } from '../components/common/ErrorState';
import { StatusBadge } from '../components/common/StatusBadge';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { Modal } from '../components/common/Modal';
import { formatDate, formatDateTime, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import {
  Calendar,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Eye,
  Clock,
  Sparkles,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  ShieldCheck,
  AlertTriangle,
  Edit,
  Trash2,
  Plus,
  History,
  RotateCcw,
  Check,
  Info,
  CalendarCheck,
} from 'lucide-react';

const statusOptions: Array<PickupStatus | 'ALL'> = [
  'ALL',
  'REQUESTED',
  'SCHEDULED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COLLECTED',
  'CANCELLED',
  'FAILED',
];

const priorityOptions: Array<PickupPriority | 'ALL'> = [
  'ALL',
  'NORMAL',
  'HIGH',
  'URGENT',
];

type OperationalTab = 'QUEUE' | 'ALLOCATED' | 'EXCLUDED' | 'ALL';

export const Pickups: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<OperationalTab>(
    tabParam === 'allocated' ? 'ALLOCATED' : tabParam === 'excluded' ? 'EXCLUDED' : tabParam === 'all' ? 'ALL' : 'QUEUE'
  );

  // Filters for ALL tab
  const requestedStatus = searchParams.get('status');
  const statusFilter = statusOptions.includes(requestedStatus as PickupStatus)
    ? (requestedStatus as PickupStatus)
    : 'ALL';

  const [priorityFilter, setPriorityFilter] = useState<PickupPriority | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'TOMORROW' | 'CUSTOM'>('ALL');
  const [customDate, setCustomDate] = useState<string>('');

  const [selectedPickup, setSelectedPickup] = useState<PickupAdminResponse | null>(null);

  // Checkbox selection for route optimization
  const [selectedPickupIds, setSelectedPickupIds] = useState<number[]>([]);

  // Schedule Modal State
  const [scheduleModalPickup, setScheduleModalPickup] = useState<PickupAdminResponse | null>(null);
  const [scheduledDate, setScheduledDate] = useState<string>('');

  // Cancel Dialog State
  const [cancelModalPickup, setCancelModalPickup] = useState<PickupAdminResponse | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Admin Full CRUD Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pickupToEdit, setPickupToEdit] = useState<PickupAdminResponse | null>(null);
  const [pickupToDelete, setPickupToDelete] = useState<PickupAdminResponse | null>(null);

  // Notification / Alert message
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const switchTab = (tab: OperationalTab) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'QUEUE') nextParams.delete('tab');
    else nextParams.set('tab', tab.toLowerCase());
    setSearchParams(nextParams, { replace: true });
  };

  // Queries
  // 1. Next-day work queue query (strictly pickups awaiting selection for tomorrow)
  const workQueueQuery = useQuery({
    queryKey: ['adminPickupsWorkQueue'],
    queryFn: () => pickupsApi.list({ work_queue: true }),
    refetchInterval: 15000,
  });

  // 2. All pickups query for general administration & tabs
  const allPickupsQuery = useQuery({
    queryKey: ['adminPickupsAll', statusFilter],
    queryFn: () => pickupsApi.list(statusFilter === 'ALL' ? undefined : (statusFilter as PickupStatus)),
    refetchInterval: 15000,
  });

  // Authoritative Planning Readiness
  const readinessQuery = useQuery({
    queryKey: ['adminPlanningReadiness'],
    queryFn: routesApi.getReadiness,
    refetchInterval: 15000,
  });

  const queuePickups = workQueueQuery.data ?? [];
  const allPickups = allPickupsQuery.data ?? [];
  const readiness = readinessQuery.data;

  // Filtered lists for tabs
  const allocatedPickups = useMemo(() => {
    return allPickups.filter((p) => p.route_id !== null && p.route_id !== undefined);
  }, [allPickups]);

  const excludedPickups = useMemo(() => {
    return allPickups.filter((p) => p.is_eligible_for_tomorrow === false);
  }, [allPickups]);

  const filteredAllPickups = useMemo(() => {
    return allPickups.filter((p) => {
      if (priorityFilter !== 'ALL' && p.priority !== priorityFilter) return false;
      const targetDate = p.scheduled_date || p.requested_date;
      if (dateFilter === 'TODAY' && (!targetDate || !targetDate.startsWith(todayStr))) return false;
      if (dateFilter === 'TOMORROW' && (!targetDate || !targetDate.startsWith(tomorrowStr))) return false;
      if (dateFilter === 'CUSTOM' && customDate && (!targetDate || !targetDate.startsWith(customDate))) return false;
      return true;
    });
  }, [allPickups, priorityFilter, dateFilter, customDate, todayStr, tomorrowStr]);

  // Current active data depending on tab
  const activeTableData = useMemo(() => {
    switch (activeTab) {
      case 'QUEUE':
        return queuePickups;
      case 'ALLOCATED':
        return allocatedPickups;
      case 'EXCLUDED':
        return excludedPickups;
      case 'ALL':
        return filteredAllPickups;
    }
  }, [activeTab, queuePickups, allocatedPickups, excludedPickups, filteredAllPickups]);

  // Mutations
  const scheduleMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      pickupsApi.schedule(id, new Date(date).toISOString()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPickupsWorkQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsAll'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      setAlert({ type: 'success', message: 'Pickup has been successfully scheduled.' });
      setScheduleModalPickup(null);
      setScheduledDate('');
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      pickupsApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPickupsWorkQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsAll'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      setAlert({ type: 'success', message: 'Pickup was cancelled successfully.' });
      setCancelModalPickup(null);
      setCancelReason('');
      if (selectedPickup) setSelectedPickup(null);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const rescheduleNextDayMutation = useMutation({
    mutationFn: (id: string) => pickupsApi.rescheduleNextDay(id),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['adminPickupsWorkQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsAll'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      setAlert({
        type: 'success',
        message: `Pickup ${p.pickup_code} rescheduled for tomorrow's operational cycle (${readiness?.planning_date || 'D+1'}).`,
      });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const releasePickupMutation = useMutation({
    mutationFn: ({ routeId, pickupId }: { routeId: number; pickupId: number }) =>
      routesApi.releasePickup(routeId, pickupId, 'Released back to work queue by administrator'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPickupsWorkQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsAll'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardRoutes'] });
      setAlert({ type: 'success', message: 'Pickup released from draft route back to the planning queue.' });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const createPickupMutation = useMutation({
    mutationFn: (payload: PickupAdminCreate) => pickupsApi.create(payload),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['adminPickupsWorkQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsAll'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      setAlert({ type: 'success', message: `Pickup ${p.pickup_code} created successfully.` });
      setShowCreateModal(false);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const updatePickupMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PickupAdminUpdate }) =>
      pickupsApi.update(id, payload),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['adminPickupsWorkQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsAll'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      setAlert({ type: 'success', message: `Pickup ${p.pickup_code} updated successfully.` });
      setPickupToEdit(null);
      if (selectedPickup?.id === p.id) setSelectedPickup(p);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const deletePickupMutation = useMutation({
    mutationFn: (id: string) => pickupsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPickupsWorkQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsAll'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      setAlert({ type: 'success', message: 'Pickup deleted successfully.' });
      setPickupToDelete(null);
      if (selectedPickup?.public_id === pickupToDelete?.public_id) setSelectedPickup(null);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const toggleSelectPickup = (id: number) => {
    setSelectedPickupIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const toggleSelectAllQueue = () => {
    if (selectedPickupIds.length === queuePickups.length && queuePickups.length > 0) {
      setSelectedPickupIds([]);
    } else {
      setSelectedPickupIds(queuePickups.map((p) => p.id));
    }
  };

  const { data: warehouses = [] } = useQuery({
    queryKey: ['adminWarehouses'],
    queryFn: () => warehousesApi.list(),
  });

  const submitBatchMutation = useMutation({
    mutationFn: (payload: { warehouse_id: number; pickup_ids: number[]; planning_date?: string }) =>
      routesApi.submitBatch(payload),
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ['adminPickupsWorkQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsAll'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      setAlert({
        type: 'success',
        message: `Submitted optimization batch ${batch.batch_code} (${batch.pickup_count} pickups) for route optimization.`,
      });
      setSelectedPickupIds([]);
      navigate(`/route-optimization?batch_id=${batch.batch_id}`);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const handleProceedToOptimization = () => {
    if (selectedPickupIds.length === 0) {
      setAlert({ type: 'info', message: 'Please select one or more pickups from tomorrow\'s queue to optimize.' });
      return;
    }
    const targetDate = readiness?.planning_date || tomorrowStr;
    const wh = warehouses.find((w) => w.active) || warehouses[0];
    const warehouseId = wh ? wh.id : 1;
    submitBatchMutation.mutate({
      warehouse_id: warehouseId,
      pickup_ids: selectedPickupIds,
      planning_date: targetDate,
    });
  };

  // Columns definition based on active tab
  const columns: Column<PickupAdminResponse>[] = useMemo(() => {
    const cols: Column<PickupAdminResponse>[] = [];

    if (activeTab === 'QUEUE') {
      cols.push({
        key: 'select',
        header: (
          <button
            type="button"
            onClick={toggleSelectAllQueue}
            className="text-charcoal-600 hover:text-charcoal-900"
            title="Select all in queue"
          >
            {selectedPickupIds.length > 0 && selectedPickupIds.length === queuePickups.length ? (
              <CheckSquare className="w-4 h-4 text-periwinkle" />
            ) : (
              <Square className="w-4 h-4 text-charcoal-300" />
            )}
          </button>
        ),
        className: 'w-10 text-center',
        render: (p) => (
          <input
            type="checkbox"
            checked={selectedPickupIds.includes(p.id)}
            onChange={(e) => {
              e.stopPropagation();
              toggleSelectPickup(p.id);
            }}
            className="rounded border-ivory-300 text-periwinkle focus:ring-periwinkle cursor-pointer"
          />
        ),
      });
    }

    cols.push(
      {
        key: 'pickup_code',
        header: 'Pickup Code',
        sortable: true,
        render: (p) => (
          <span className="font-mono font-semibold text-charcoal-900">{p.pickup_code}</span>
        ),
      },
      {
        key: 'status',
        header: 'Operational Status',
        sortable: true,
        render: (p) => {
          if (activeTab === 'ALLOCATED') {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-periwinkle-100 text-periwinkle-900">
                {p.operational_state?.toUpperCase() || 'ALLOCATED'}
              </span>
            );
          }
          if (activeTab === 'QUEUE') {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                <Check className="w-3 h-3 text-emerald-600" />
                Awaiting Selection
              </span>
            );
          }
          return <StatusBadge status={p.status} />;
        },
      },
      {
        key: 'priority',
        header: 'Priority',
        sortable: true,
        render: (p) => <StatusBadge status={p.priority} size="sm" />,
      },
      {
        key: 'customer',
        header: 'Customer & Location',
        render: (p) => (
          <div>
            <div className="font-medium text-charcoal-900">{p.customer_name || `CUST-#${p.customer_id}`}</div>
            <div className="text-[11px] text-charcoal-500 truncate max-w-xs">{p.location_name || p.location_address || `LOC-#${p.location_id}`}</div>
          </div>
        ),
      },
      {
        key: 'estimated_weight_kg',
        header: 'Est. Weight',
        sortable: true,
        render: (p) => (
          <span className="font-semibold text-charcoal-800">
            {p.estimated_weight_kg ? formatWeight(p.estimated_weight_kg) : '1.0 kg'}
          </span>
        ),
      }
    );

    if (activeTab === 'ALLOCATED') {
      cols.push({
        key: 'route_code',
        header: 'Allocated Route',
        render: (p) => (
          <div>
            <span className="font-mono font-bold text-charcoal-900">{p.route_code || '—'}</span>
            <div className="text-[10px] text-charcoal-500 uppercase">{p.route_status}</div>
          </div>
        ),
      });
    }

    if (activeTab === 'EXCLUDED') {
      cols.push({
        key: 'ineligibility_reason',
        header: 'Exclusion Reason',
        render: (p) => (
          <span className="text-rose-700 font-semibold text-xs inline-flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            {p.ineligibility_reason || 'Ineligible for next-day run'}
          </span>
        ),
      });
    }

    if (activeTab === 'ALL') {
      cols.push({
        key: 'scheduled_date',
        header: 'Scheduled Date',
        sortable: true,
        render: (p) => (
          <span className="font-medium text-charcoal-800">
            {formatDate(p.scheduled_date || p.requested_date)}
          </span>
        ),
      });
    }

    cols.push({
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {activeTab === 'ALLOCATED' && p.route_id && p.route_status === 'DRAFT' && (
            <button
              onClick={() => releasePickupMutation.mutate({ routeId: p.route_id!, pickupId: p.id })}
              disabled={releasePickupMutation.isPending}
              className="px-2 py-1 rounded text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
              title="Release pickup from unapproved draft route back to work queue"
            >
              Release
            </button>
          )}

          {activeTab === 'EXCLUDED' && (
            <button
              onClick={() => rescheduleNextDayMutation.mutate(p.public_id)}
              disabled={rescheduleNextDayMutation.isPending}
              className="px-2 py-1 rounded text-[11px] font-bold text-periwinkle-900 bg-periwinkle-100 hover:bg-periwinkle-200 border border-periwinkle-300 transition-colors inline-flex items-center gap-1"
              title="Reschedule to tomorrow's operational planning cycle"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reschedule Tomorrow</span>
            </button>
          )}

          {p.status === 'REQUESTED' && (
            <button
              onClick={() => {
                setScheduleModalPickup(p);
                setScheduledDate('');
              }}
              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
              title="Schedule Pickup"
            >
              <Calendar className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setPickupToEdit(p)}
            className="p-1.5 rounded-lg text-charcoal-600 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Edit Consignment"
          >
            <Edit className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedPickup(p)}
            className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Inspect Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    });

    return cols;
  }, [activeTab, selectedPickupIds, queuePickups, releasePickupMutation, rescheduleNextDayMutation]);

  return (
    <div className="space-y-6">
      {/* Alert */}
      {alert && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : alert.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : alert.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            ) : (
              <Sparkles className="w-4 h-4 text-blue-600" />
            )}
            <span>{alert.message}</span>
          </div>
          <button onClick={() => setAlert(null)} className="font-bold opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-charcoal-900 tracking-tight">
              Pickup Planning & Operational Work Queue
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-periwinkle-100 text-periwinkle-900">
              Target: {readiness?.planning_date || 'Tomorrow (Asia/Kolkata)'}
            </span>
          </div>
          <p className="text-xs text-charcoal-500 mt-1">
            Pickups strictly requiring next-day planning. Pickups included in draft or active routes automatically disappear from the available queue.
          </p>
        </div>

        {/* Primary Operational Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/pickup-history"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-ivory-100 text-charcoal-800 border border-ivory-300 rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <History className="w-4 h-4 text-charcoal-500" />
            <span>Pickup History</span>
          </Link>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-charcoal-900 hover:bg-charcoal-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 text-periwinkle" />
            <span>Create Pickup</span>
          </button>

          {activeTab === 'QUEUE' && (
            <button
              onClick={handleProceedToOptimization}
              disabled={selectedPickupIds.length === 0 || submitBatchMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {submitBatchMutation.isPending
                  ? 'Submitting to Optimization...'
                  : `Submit for Optimization (${selectedPickupIds.length})`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Operational Work Queue Tabs */}
      <div className="border-b border-ivory-300 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => switchTab('QUEUE')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'QUEUE'
                ? 'border-charcoal-900 text-charcoal-900'
                : 'border-transparent text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Awaiting Selection ({queuePickups.length})</span>
          </button>

          <button
            onClick={() => switchTab('ALLOCATED')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'ALLOCATED'
                ? 'border-charcoal-900 text-charcoal-900'
                : 'border-transparent text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Allocated to Routes ({allocatedPickups.length})</span>
          </button>

          <button
            onClick={() => switchTab('EXCLUDED')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'EXCLUDED'
                ? 'border-charcoal-900 text-charcoal-900'
                : 'border-transparent text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Excluded / Ineligible ({excludedPickups.length})</span>
          </button>

          <button
            onClick={() => switchTab('ALL')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'ALL'
                ? 'border-charcoal-900 text-charcoal-900'
                : 'border-transparent text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>All Pickups & Search</span>
          </button>
        </div>
      </div>

      {/* Tab Context Banners */}
      {activeTab === 'QUEUE' && (
        <div className="p-3 bg-periwinkle-50 border border-periwinkle-200 rounded-xl flex items-center justify-between text-xs text-periwinkle-950">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-periwinkle-700 shrink-0" />
            <span>
              <strong>Next-Day Planning Queue:</strong> Showing {queuePickups.length} scheduled consignments awaiting route inclusion for tomorrow ({readiness?.planning_date || 'D+1'}). Pickups in draft or dispatched routes are automatically hidden.
            </span>
          </div>
          <button
            onClick={toggleSelectAllQueue}
            className="font-bold underline ml-4 whitespace-nowrap hover:text-periwinkle-800"
          >
            {selectedPickupIds.length === queuePickups.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      )}

      {activeTab === 'ALLOCATED' && (
        <div className="p-3 bg-ivory-100 border border-ivory-300 rounded-xl flex items-center justify-between text-xs text-charcoal-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Allocated Pickups:</strong> Consignments already linked to routes. Pickups in unapproved draft routes can be released back to the planning queue.
            </span>
          </div>
        </div>
      )}

      {activeTab === 'EXCLUDED' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Excluded Pickups:</strong> Consignments not eligible for tomorrow's planning cycle. Click <em>Reschedule Tomorrow</em> to safely recover failed or past pickups into tomorrow's operational queue.
            </span>
          </div>
        </div>
      )}

      {/* Pickups Table */}
      {workQueueQuery.error || allPickupsQuery.error ? (
        <ErrorState
          title="Unable to load pickups"
          message="An unexpected error occurred while communicating with the server."
          onRetry={() => {
            void workQueueQuery.refetch();
            void allPickupsQuery.refetch();
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={activeTableData}
          isLoading={activeTab === 'QUEUE' ? workQueueQuery.isLoading : allPickupsQuery.isLoading}
          searchPlaceholder="Search by pickup code, customer name, or location..."
          searchFilter={(row, q) =>
            row.pickup_code.toLowerCase().includes(q) ||
            (row.customer_name && row.customer_name.toLowerCase().includes(q)) ||
            (row.location_name && row.location_name.toLowerCase().includes(q)) ||
            (row.route_code && row.route_code.toLowerCase().includes(q)) ||
            String(row.customer_id).includes(q)
          }
          onRowClick={(p) => setSelectedPickup(p)}
        />
      )}

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedPickup}
        onClose={() => setSelectedPickup(null)}
        title={selectedPickup?.pickup_code || 'Pickup Details'}
        subtitle={`Customer #${selectedPickup?.customer_id} · Location #${selectedPickup?.location_id}`}
        width="lg"
      >
        {selectedPickup && (
          <div className="space-y-6 text-sm">
            <div className="p-4 bg-ivory-100 rounded-xl border border-ivory-300 flex items-center justify-between">
              <div>
                <span className="text-xs text-charcoal-500 font-medium">Status</span>
                <div className="mt-1">
                  <StatusBadge status={selectedPickup.status} size="md" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-charcoal-500 font-medium">Priority</span>
                <div className="mt-1">
                  <StatusBadge status={selectedPickup.priority} size="md" />
                </div>
              </div>
            </div>

            {selectedPickup.route_code && (
              <div className="p-3.5 bg-periwinkle-50 rounded-xl border border-periwinkle-200 text-xs">
                <span className="text-periwinkle-800 font-bold block mb-1">Allocated Route Details</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-charcoal-900">{selectedPickup.route_code}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-periwinkle-200 text-periwinkle-900">
                    {selectedPickup.route_status}
                  </span>
                </div>
              </div>
            )}

            {selectedPickup.ineligibility_reason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                <span className="font-bold block mb-1">Ineligibility Reason</span>
                <span>{selectedPickup.ineligibility_reason}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-xs text-charcoal-600">
              <div>
                <span className="text-charcoal-400 font-bold block mb-1">Requested Date</span>
                <span>{formatDate(selectedPickup.requested_date)}</span>
              </div>
              <div>
                <span className="text-charcoal-400 font-bold block mb-1">Scheduled Date</span>
                <span className="font-semibold text-charcoal-900">
                  {formatDate(selectedPickup.scheduled_date)}
                </span>
              </div>
              <div>
                <span className="text-charcoal-400 font-bold block mb-1">Estimated Weight</span>
                <span className="font-semibold text-charcoal-900">
                  {selectedPickup.estimated_weight_kg ? formatWeight(selectedPickup.estimated_weight_kg) : '1.0 kg'}
                </span>
              </div>
              <div>
                <span className="text-charcoal-400 font-bold block mb-1">Operational State</span>
                <span className="font-semibold text-charcoal-900 uppercase">
                  {selectedPickup.operational_state || 'AWAITING_SELECTION'}
                </span>
              </div>
            </div>

            {selectedPickup.notes && (
              <div className="p-3 bg-white rounded-lg border border-ivory-300">
                <span className="text-[10px] font-bold text-charcoal-400 uppercase tracking-wider block mb-1">
                  Special Instructions / Handling Notes
                </span>
                <p className="text-xs text-charcoal-800 leading-relaxed">{selectedPickup.notes}</p>
              </div>
            )}

            {/* Drawer Actions */}
            <div className="pt-4 border-t border-ivory-200 flex flex-wrap items-center justify-between gap-2">
              {selectedPickup.route_id && selectedPickup.route_status === 'DRAFT' && (
                <button
                  onClick={() => {
                    releasePickupMutation.mutate({ routeId: selectedPickup.route_id!, pickupId: selectedPickup.id });
                    setSelectedPickup(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300"
                >
                  Release from Draft Route
                </button>
              )}

              {selectedPickup.is_eligible_for_tomorrow === false && (
                <button
                  onClick={() => {
                    rescheduleNextDayMutation.mutate(selectedPickup.public_id);
                    setSelectedPickup(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-periwinkle-900 bg-periwinkle-100 hover:bg-periwinkle-200 border border-periwinkle-300 inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reschedule to Tomorrow</span>
                </button>
              )}

              {selectedPickup.status === 'REQUESTED' && (
                <button
                  onClick={() => {
                    setScheduleModalPickup(selectedPickup);
                    setScheduledDate('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule Pickup</span>
                </button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Schedule Modal */}
      <Modal
        isOpen={!!scheduleModalPickup}
        onClose={() => setScheduleModalPickup(null)}
        title="Schedule Consignment Pickup"
        subtitle={`Pickup ${scheduleModalPickup?.pickup_code}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!scheduleModalPickup || !scheduledDate) return;
            scheduleMutation.mutate({ id: scheduleModalPickup.public_id, date: scheduledDate });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1.5">
              Target Execution Date & Time
            </label>
            <input
              type="datetime-local"
              required
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:outline-none focus:ring-2 focus:ring-periwinkle"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setScheduleModalPickup(null)}
              className="px-4 py-2 text-xs font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={scheduleMutation.isPending}
              className="px-4 py-2 text-xs font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {scheduleMutation.isPending ? 'Scheduling...' : 'Confirm Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={!!cancelModalPickup}
        onClose={() => setCancelModalPickup(null)}
        title="Cancel Consignment Pickup"
        subtitle={`Pickup ${cancelModalPickup?.pickup_code}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1.5">
              Cancellation Reason
            </label>
            <textarea
              required
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="State the reason for cancellation (1-1000 characters)..."
              className="w-full px-3 py-2 text-sm bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:outline-none focus:ring-2 focus:ring-periwinkle"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setCancelModalPickup(null)}
              className="px-4 py-2 text-xs font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (!cancelModalPickup || !cancelReason.trim()) return;
                cancelMutation.mutate({ id: cancelModalPickup.public_id, reason: cancelReason.trim() });
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Modal */}
      {showCreateModal && (
        <CreatePickupModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(payload) => createPickupMutation.mutate(payload)}
          isSubmitting={createPickupMutation.isPending}
        />
      )}

      {/* Edit Modal */}
      {pickupToEdit && (
        <EditPickupModal
          pickup={pickupToEdit}
          onClose={() => setPickupToEdit(null)}
          onSubmit={(payload) => updatePickupMutation.mutate({ id: pickupToEdit.public_id, payload })}
          isSubmitting={updatePickupMutation.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!pickupToDelete}
        onClose={() => setPickupToDelete(null)}
        title="Delete Consignment Pickup"
        subtitle={`Confirm deletion of ${pickupToDelete?.pickup_code}`}
      >
        <div className="space-y-4 text-xs text-charcoal-700">
          <p>
            Are you sure you want to permanently delete consignment{' '}
            <strong className="font-mono text-charcoal-900">{pickupToDelete?.pickup_code}</strong>?
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              onClick={() => setPickupToDelete(null)}
              className="px-4 py-2 bg-white border border-ivory-300 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (pickupToDelete) deletePickupMutation.mutate(pickupToDelete.public_id);
              }}
              disabled={deletePickupMutation.isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg disabled:opacity-50"
            >
              {deletePickupMutation.isPending ? 'Deleting...' : 'Delete Consignment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Subcomponent: Create Modal
interface CreatePickupModalProps {
  onClose: () => void;
  onSubmit: (payload: PickupAdminCreate) => void;
  isSubmitting: boolean;
}

const CreatePickupModal: React.FC<CreatePickupModalProps> = ({ onClose, onSubmit, isSubmitting }) => {
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [locationId, setLocationId] = useState<number | ''>('');
  const [priority, setPriority] = useState<PickupPriority>('NORMAL');
  const [notes, setNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

  const { data: customers = [] } = useQuery({
    queryKey: ['adminCustomersList'],
    queryFn: () => customersApi.list(0, 200),
  });

  const { data: customerDetail } = useQuery({
    queryKey: ['adminCustomerDetail', customerId],
    queryFn: () => customersApi.getById(Number(customerId)),
    enabled: typeof customerId === 'number' && customerId > 0,
  });

  const locations = customerDetail?.locations || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !locationId) return;
    onSubmit({
      customer_id: Number(customerId),
      location_id: Number(locationId),
      priority,
      notes: notes || null,
      scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
    });
  };

  return (
    <Modal isOpen onClose={onClose} title="Create Consignment Pickup" subtitle="New scheduled or requested pickup">
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div>
          <label className="block font-semibold text-charcoal-700 mb-1">Customer Account</label>
          <select
            required
            value={customerId}
            onChange={(e) => {
              setCustomerId(Number(e.target.value));
              setLocationId('');
            }}
            className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
          >
            <option value="">Select customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name} ({c.customer_type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-charcoal-700 mb-1">Facility / Store Location</label>
          <select
            required
            disabled={!customerId}
            value={locationId}
            onChange={(e) => setLocationId(Number(e.target.value))}
            className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal disabled:opacity-50"
          >
            <option value="">Select pickup location...</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} · {loc.city}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PickupPriority)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Target Scheduled Date</label>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-charcoal-700 mb-1">Special Handling Instructions</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Handling notes, access gates, OTP contacts..."
            className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-ivory-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-ivory-300 rounded-lg text-charcoal-700 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !customerId || !locationId}
            className="px-4 py-2 bg-periwinkle hover:bg-periwinkle-600 font-bold text-charcoal-900 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Pickup'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Subcomponent: Edit Modal
interface EditPickupModalProps {
  pickup: PickupAdminResponse;
  onClose: () => void;
  onSubmit: (payload: PickupAdminUpdate) => void;
  isSubmitting: boolean;
}

const EditPickupModal: React.FC<EditPickupModalProps> = ({ pickup, onClose, onSubmit, isSubmitting }) => {
  const [priority, setPriority] = useState<PickupPriority>(pickup.priority);
  const [status, setStatus] = useState<PickupStatus>(pickup.status);
  const [scheduledDate, setScheduledDate] = useState(
    pickup.scheduled_date ? new Date(pickup.scheduled_date).toISOString().slice(0, 16) : ''
  );
  const [notes, setNotes] = useState(pickup.notes || '');
  const [failureReason, setFailureReason] = useState(pickup.failure_reason || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      priority,
      status,
      scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
      notes: notes || null,
      failure_reason: failureReason || null,
    });
  };

  return (
    <Modal isOpen onClose={onClose} title="Edit Consignment Pickup" subtitle={`Pickup ${pickup.pickup_code}`}>
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Consignment Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PickupStatus)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="REQUESTED">REQUESTED</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COLLECTED">COLLECTED</option>
              <option value="FAILED">FAILED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PickupPriority)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-charcoal-700 mb-1">Target Scheduled Date & Time</label>
          <input
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
          />
        </div>

        <div>
          <label className="block font-semibold text-charcoal-700 mb-1">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
          />
        </div>

        {['FAILED', 'CANCELLED'].includes(status) && (
          <div>
            <label className="block font-semibold text-rose-700 mb-1">Failure / Cancellation Reason</label>
            <textarea
              rows={2}
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              className="w-full px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-charcoal"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-ivory-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-ivory-300 rounded-lg text-charcoal-700 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-periwinkle hover:bg-periwinkle-600 font-bold text-charcoal-900 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Update Consignment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default Pickups;
