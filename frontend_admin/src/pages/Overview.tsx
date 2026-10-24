import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowRight,
  CalendarCheck,
  ClipboardList,
  MapPin,
  Warehouse,
  Truck,
  Users,
  CreditCard,
  Sparkles,
  Scale,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Navigation,
  AlertTriangle,
  Info,
  Check,
} from 'lucide-react';
import {
  dashboardApi,
  exceptionsApi,
  pickupsApi,
  routesApi,
  fleetApi,
  invoicesApi,
} from '../api/operations';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate, formatDateTime, formatCurrency, formatWeight } from '../utils/formatters';
import { OperationalExceptionResponse, PickupAdminResponse, RouteResponse } from '../types/operations';

interface OperationalMetricCardProps {
  title: string;
  count: number | string | undefined;
  subtitle: string;
  to: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'blue';
  isLoading: boolean;
  isUnavailable?: boolean;
}

const OperationalMetricCard: React.FC<OperationalMetricCardProps> = ({
  title,
  count,
  subtitle,
  to,
  icon: Icon,
  badge,
  badgeColor = 'blue',
  isLoading,
  isUnavailable,
}) => {
  const badgeClasses = {
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    blue: 'bg-blue-100 text-blue-800',
  }[badgeColor];

  return (
    <Link
      to={to}
      className="p-5 bg-white rounded-xl border border-ivory-300 shadow-subtle hover:border-ivory-400 hover:shadow-card transition-all flex flex-col justify-between group"
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">
          {title}
        </span>
        <div className="p-2 rounded-lg bg-ivory-100 text-charcoal-700 group-hover:bg-periwinkle-100 group-hover:text-periwinkle-900 transition-colors">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="my-3">
        {isLoading ? (
          <div className="h-7 w-20 bg-ivory-200 rounded animate-pulse" />
        ) : isUnavailable ? (
          <span className="text-sm font-semibold text-charcoal-400">Unavailable</span>
        ) : (
          <div className="text-2xl font-bold text-charcoal-900 tracking-tight">
            {count}
          </div>
        )}
        <p className="text-xs text-charcoal-500 mt-1">{subtitle}</p>
      </div>

      <div className="pt-2 border-t border-ivory-100 flex items-center justify-between text-xs">
        {badge ? (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeClasses}`}>
            {badge}
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 font-semibold text-periwinkle-800 group-hover:text-periwinkle-950">
          <span>View queue</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  );
};

export const Overview: React.FC = () => {
  // Authoritative Next-Day Planning Readiness
  const readinessQuery = useQuery({
    queryKey: ['adminPlanningReadiness'],
    queryFn: routesApi.getReadiness,
    refetchInterval: 15000,
  });

  // Real-time Queries (polling every 15 seconds)
  const summaryQuery = useQuery({
    queryKey: ['adminDashboardSummary'],
    queryFn: dashboardApi.getSummary,
    refetchInterval: 15000,
  });

  const driversQuery = useQuery({
    queryKey: ['adminDashboardDrivers'],
    queryFn: () => fleetApi.listDrivers(0, 100),
    refetchInterval: 15000,
  });

  const vehiclesQuery = useQuery({
    queryKey: ['adminDashboardVehicles'],
    queryFn: () => fleetApi.listVehicles(0, 100),
    refetchInterval: 15000,
  });

  const invoicesQuery = useQuery({
    queryKey: ['adminDashboardInvoices'],
    queryFn: () => invoicesApi.list({ limit: 100 }),
    refetchInterval: 15000,
  });

  const exceptionsQuery = useQuery({
    queryKey: ['adminDashboardExceptions'],
    queryFn: () => exceptionsApi.list(),
    refetchInterval: 15000,
  });

  const readiness = readinessQuery.data;
  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const exceptions = exceptionsQuery.data ?? [];

  // Fleet availability
  const availableDrivers = useMemo(() => {
    return drivers.filter((d) => d.status === 'ACTIVE' && d.is_available);
  }, [drivers]);

  const availableVehicles = useMemo(() => {
    return vehicles.filter((v) => v.status === 'AVAILABLE');
  }, [vehicles]);

  const openExceptions = useMemo(() => {
    return exceptions.filter((e) => e.status !== 'RESOLVED');
  }, [exceptions]);

  const unpaidInvoices = useMemo(() => {
    return invoices.filter((i) => i.status !== 'PAID');
  }, [invoices]);

  const totalOutstandingAmount = useMemo(() => {
    return unpaidInvoices.reduce((sum, i) => sum + Number(i.outstanding_amount || 0), 0);
  }, [unpaidInvoices]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <header className="flex flex-col gap-4 rounded-2xl bg-charcoal-900 p-6 text-white shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-periwinkle">
              Operations Control Center
            </p>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <h1 className="mt-1.5 text-xl font-bold tracking-tight md:text-2xl">
            Next-Day Operational Command & Control
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-charcoal-300">
            Strict next-day operational planning cycle (Asia/Kolkata). Pickups progress linearly from work queue selection, optimization, and explicit approval to fleet assignment and dispatch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/pickups"
            className="inline-flex items-center gap-1.5 rounded-xl bg-periwinkle px-3.5 py-2 text-xs font-semibold text-charcoal-900 hover:bg-periwinkle-400 transition-colors shadow-sm"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            <span>Tomorrow's Pickups</span>
          </Link>

          <Link
            to="/route-optimization"
            className="inline-flex items-center gap-1.5 rounded-xl border border-charcoal-700 bg-charcoal-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-charcoal-700 transition-colors shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-periwinkle" />
            <span>Optimize Routes</span>
          </Link>
        </div>
      </header>

      {/* 2. Planning Readiness Summary Indicator */}
      <section className="rounded-2xl border border-periwinkle-200 bg-gradient-to-br from-periwinkle-50/60 via-white to-ivory-50 p-6 shadow-subtle">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-ivory-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-periwinkle-100 text-periwinkle-900">
                Operating Date: {readiness?.planning_date || 'Tomorrow'}
              </span>
              <span className="text-[11px] text-charcoal-500">
                Timezone: {readiness?.timezone || 'Asia/Kolkata'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-charcoal-900 mt-1">
              Next-Day Planning Readiness Status
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {readiness?.is_ready_for_dispatch ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Ready for Dispatch
              </span>
            ) : readiness && readiness.blockers.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                {readiness.blockers.length} Action{readiness.blockers.length > 1 ? 's' : ''} Pending
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 font-bold text-xs">
                <Clock className="w-4 h-4 text-blue-600" />
                Planning In Progress
              </span>
            )}
          </div>
        </div>

        {/* Readiness Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
          <div className="bg-white p-3.5 rounded-xl border border-ivory-200 shadow-xs">
            <span className="text-[11px] font-semibold text-charcoal-500 uppercase">Tomorrow's Pickups</span>
            <div className="text-xl font-bold text-charcoal-900 mt-1">
              {readinessQuery.isLoading ? '…' : readiness?.total_pickups_requested_tomorrow ?? 0}
            </div>
            <span className="text-[10px] text-charcoal-400">Total requested for D+1</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-ivory-200 shadow-xs">
            <span className="text-[11px] font-semibold text-charcoal-500 uppercase">Awaiting Selection</span>
            <div className="text-xl font-bold text-amber-600 mt-1">
              {readinessQuery.isLoading ? '…' : readiness?.eligible_pickups_awaiting_selection ?? 0}
            </div>
            <span className="text-[10px] text-charcoal-400">Eligible in work queue</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-ivory-200 shadow-xs">
            <span className="text-[11px] font-semibold text-charcoal-500 uppercase">Allocated to Routes</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {readinessQuery.isLoading ? '…' : readiness?.pickups_allocated_to_routes ?? 0}
            </div>
            <span className="text-[10px] text-charcoal-400">In draft / active routes</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-ivory-200 shadow-xs">
            <span className="text-[11px] font-semibold text-charcoal-500 uppercase">Routes Awaiting Review</span>
            <div className="text-xl font-bold text-periwinkle-900 mt-1">
              {readinessQuery.isLoading ? '…' : readiness?.routes_awaiting_review ?? 0}
            </div>
            <span className="text-[10px] text-charcoal-400">Drafts pending approval</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-ivory-200 shadow-xs">
            <span className="text-[11px] font-semibold text-charcoal-500 uppercase">Awaiting Assignment</span>
            <div className="text-xl font-bold text-blue-600 mt-1">
              {readinessQuery.isLoading ? '…' : readiness?.routes_awaiting_assignment ?? 0}
            </div>
            <span className="text-[10px] text-charcoal-400">Approved, need fleet</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-ivory-200 shadow-xs">
            <span className="text-[11px] font-semibold text-charcoal-500 uppercase">Awaiting Dispatch</span>
            <div className="text-xl font-bold text-purple-600 mt-1">
              {readinessQuery.isLoading ? '…' : readiness?.routes_awaiting_dispatch ?? 0}
            </div>
            <span className="text-[10px] text-charcoal-400">Assigned, ready to send</span>
          </div>
        </div>

        {/* Fleet Capacity & Blockers */}
        <div className="mt-4 pt-3 border-t border-ivory-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-charcoal-500">Total Tomorrow Demand:</span>{' '}
              <strong className="text-charcoal-900">{formatWeight(readiness?.total_demand_kg ?? 0)}</strong>
            </div>
            <div>
              <span className="text-charcoal-500">Available Fleet Capacity:</span>{' '}
              <strong className="text-charcoal-900">{formatWeight(readiness?.available_fleet_capacity_kg ?? 0)}</strong>
            </div>
            {readiness && readiness.capacity_shortfall_kg > 0 ? (
              <div className="text-rose-600 font-bold flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5" />
                Shortfall: {formatWeight(readiness.capacity_shortfall_kg)}
              </div>
            ) : (
              <div className="text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Capacity Sufficient
              </div>
            )}
          </div>

          {readiness && readiness.pickups_excluded_count > 0 && (
            <Link
              to="/pickups?tab=excluded"
              className="text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-1"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{readiness.pickups_excluded_count} pickup(s) excluded (see reasons)</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </section>

      {/* 3. Primary Operational Sequence Guide */}
      <section className="bg-white rounded-xl border border-ivory-300 p-5 shadow-subtle">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider">
            Authoritative Linear Workflow Sequence
          </h3>
          <span className="text-[11px] font-medium text-charcoal-500">Strict D+1 Lifecycle</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
          <Link
            to="/pickups"
            className="p-3 bg-ivory-50 rounded-lg border border-ivory-200 hover:border-periwinkle hover:bg-ivory-100 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between font-bold text-charcoal-900">
              <span>1. Queue</span>
              <CalendarCheck className="w-4 h-4 text-periwinkle-700" />
            </div>
            <p className="text-[11px] text-charcoal-500 mt-2">Filter next-day work</p>
          </Link>

          <Link
            to="/route-optimization"
            className="p-3 bg-ivory-50 rounded-lg border border-ivory-200 hover:border-periwinkle hover:bg-ivory-100 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between font-bold text-charcoal-900">
              <span>2. Optimize</span>
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-[11px] text-charcoal-500 mt-2">Cluster multi-vehicle</p>
          </Link>

          <Link
            to="/route-optimization?tab=review"
            className="p-3 bg-ivory-50 rounded-lg border border-ivory-200 hover:border-periwinkle hover:bg-ivory-100 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between font-bold text-charcoal-900">
              <span>3. Review</span>
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-[11px] text-charcoal-500 mt-2">Approve draft routes</p>
          </Link>

          <Link
            to="/fleet?tab=assignments"
            className="p-3 bg-ivory-50 rounded-lg border border-ivory-200 hover:border-periwinkle hover:bg-ivory-100 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between font-bold text-charcoal-900">
              <span>4. Assign</span>
              <Truck className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-[11px] text-charcoal-500 mt-2">Pair driver & vehicle</p>
          </Link>

          <Link
            to="/dispatch"
            className="p-3 bg-ivory-50 rounded-lg border border-ivory-200 hover:border-periwinkle hover:bg-ivory-100 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between font-bold text-charcoal-900">
              <span>5. Dispatch</span>
              <Navigation className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-[11px] text-charcoal-500 mt-2">Notify drivers & start</p>
          </Link>

          <Link
            to="/warehouses"
            className="p-3 bg-ivory-50 rounded-lg border border-ivory-200 hover:border-periwinkle hover:bg-ivory-100 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between font-bold text-charcoal-900">
              <span>6. Intake</span>
              <Warehouse className="w-4 h-4 text-charcoal-700" />
            </div>
            <p className="text-[11px] text-charcoal-500 mt-2">Weigh & classify bins</p>
          </Link>

          <Link
            to="/certificates"
            className="p-3 bg-ivory-50 rounded-lg border border-ivory-200 hover:border-periwinkle hover:bg-ivory-100 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between font-bold text-charcoal-900">
              <span>7. Disposal</span>
              <Scale className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-[11px] text-charcoal-500 mt-2">Manifests & certs</p>
          </Link>

          <Link
            to="/billing"
            className="p-3 bg-ivory-50 rounded-lg border border-ivory-200 hover:border-periwinkle hover:bg-ivory-100 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between font-bold text-charcoal-900">
              <span>8. Billing</span>
              <CreditCard className="w-4 h-4 text-emerald-700" />
            </div>
            <p className="text-[11px] text-charcoal-500 mt-2">Settle invoices</p>
          </Link>
        </div>
      </section>

      {/* 4. Fleet Availability & Pending Actions */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xs font-bold text-charcoal-700 uppercase tracking-wider mb-3">
            Fleet Availability & Compliance Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <OperationalMetricCard
              title="Available Drivers"
              count={`${availableDrivers.length} / ${drivers.length}`}
              subtitle="Active drivers ready for next-day deployment"
              to="/fleet?tab=drivers"
              icon={Users}
              badge={`${availableDrivers.length} Online`}
              badgeColor="emerald"
              isLoading={driversQuery.isLoading}
            />

            <OperationalMetricCard
              title="Available Fleet Vehicles"
              count={`${availableVehicles.length} / ${vehicles.length}`}
              subtitle={`Total carrying capacity: ${formatWeight(readiness?.available_fleet_capacity_kg ?? 0)}`}
              to="/fleet?tab=vehicles"
              icon={Truck}
              badge={`${availableVehicles.length} Free`}
              badgeColor="emerald"
              isLoading={vehiclesQuery.isLoading}
            />

            <OperationalMetricCard
              title="Operational Exceptions"
              count={openExceptions.length}
              subtitle="Discrepancies, failed pickups, & escalations"
              to="/exceptions?status=OPEN"
              icon={AlertOctagon}
              badge={openExceptions.length > 0 ? `${openExceptions.length} Open` : 'Clear'}
              badgeColor={openExceptions.length > 0 ? 'rose' : 'emerald'}
              isLoading={exceptionsQuery.isLoading}
            />

            <OperationalMetricCard
              title="Unpaid / Overdue Invoices"
              count={formatCurrency(totalOutstandingAmount, 'INR')}
              subtitle={`${unpaidInvoices.length} invoices awaiting settlement`}
              to="/billing"
              icon={CreditCard}
              badge={unpaidInvoices.length > 0 ? 'Pending Payment' : 'Reconciled'}
              badgeColor={unpaidInvoices.length > 0 ? 'rose' : 'emerald'}
              isLoading={invoicesQuery.isLoading}
            />
          </div>
        </div>
      </div>

      {/* 5. Warehouse Intake Callout */}
      <section className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-amber-950">Pending Warehouse Intake Handover</h2>
            <p className="mt-1 text-xs text-amber-900">
              {summaryQuery.data
                ? `${summaryQuery.data.pending_warehouse_intakes} intake${summaryQuery.data.pending_warehouse_intakes === 1 ? '' : 's'} pending.`
                : 'Loading pending intake count...'}
              {' '}Total verified collected weight across system: {summaryQuery.data ? formatWeight(summaryQuery.data.total_collected_weight_kg) : '—'}.
            </p>
          </div>
        </div>
        <Link
          to="/warehouses"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-900 hover:underline"
        >
          Open warehouse intake <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
};

export default Overview;
