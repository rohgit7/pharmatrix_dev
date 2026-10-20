import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, pickupsApi, routesApi, exceptionsApi } from '../api/operations';
import { StatCard } from '../components/common/StatCard';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatWeight, formatDate } from '../utils/formatters';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  MapPin,
  Warehouse,
  AlertOctagon,
  Scale,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';

export const Overview: React.FC = () => {
  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['adminDashboardSummary'],
    queryFn: dashboardApi.getSummary,
    refetchInterval: 15000,
  });

  const { data: recentPickups = [], isLoading: isPickupsLoading } = useQuery({
    queryKey: ['recentPickups'],
    queryFn: () => pickupsApi.list(),
  });

  const { data: activeRoutes = [], isLoading: isRoutesLoading } = useQuery({
    queryKey: ['activeRoutes'],
    queryFn: () => routesApi.list(),
  });

  const { data: openExceptions = [], isLoading: isExceptionsLoading } = useQuery({
    queryKey: ['openExceptions'],
    queryFn: () => exceptionsApi.list({ status: 'OPEN' }),
  });

  if (summaryError) {
    return (
      <div className="space-y-6">
        <ErrorState
          title="Failed to connect to dashboard metrics"
          message={(summaryError as Error).message}
          onRetry={refetchSummary}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-charcoal-900 rounded-2xl p-6 text-white border border-charcoal-800 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-charcoal-800 border border-charcoal-700 text-xs text-periwinkle-300 font-semibold mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-periwinkle animate-pulse" />
            Live Operations Control
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Pharmatrix Control Tower</h2>
          <p className="text-xs md:text-sm text-charcoal-300 mt-1 max-w-xl">
            Real-time tracking of pharmaceutical consignment chain of custody, route dispatch, warehouse intakes, and disposal certifications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/routes"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-periwinkle text-charcoal-900 hover:bg-periwinkle-400 transition-colors shadow-sm inline-flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Dispatch Route</span>
          </Link>
          <Link
            to="/pickups"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-charcoal-800 text-white hover:bg-charcoal-700 border border-charcoal-700 transition-colors inline-flex items-center gap-1.5"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Manage Pickups</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {isSummaryLoading ? (
        <LoadingSkeleton type="stat-card" count={4} />
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Consignments"
            value={summary.total_pickups}
            subtitle={`${summary.today_scheduled_pickups} scheduled for collection today`}
            icon={CalendarCheck}
            variant="default"
            badge={`${summary.pending_pickups} pending`}
            badgeType="warning"
          />
          <StatCard
            title="Active Dispatch Routes"
            value={summary.active_routes}
            subtitle="Vehicles executing collections"
            icon={MapPin}
            variant="primary"
          />
          <StatCard
            title="Total Collected Weight"
            value={formatWeight(summary.total_collected_weight_kg)}
            subtitle="Verified at collection stops"
            icon={Scale}
            variant="default"
          />
          <StatCard
            title="Pending Intakes / Exceptions"
            value={summary.pending_warehouse_intakes + summary.open_exceptions}
            subtitle={`${summary.open_exceptions} exceptions require investigation`}
            icon={AlertOctagon}
            variant={summary.open_exceptions > 0 ? 'warning' : 'default'}
            badge={summary.open_exceptions > 0 ? 'Action Needed' : 'Normal'}
            badgeType={summary.open_exceptions > 0 ? 'warning' : 'success'}
          />
        </div>
      ) : null}

      {/* Operations Split: Recent Pickups & Live Routes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Pickups */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-ivory-300 shadow-subtle overflow-hidden">
          <div className="p-4 border-b border-ivory-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-periwinkle-700" />
              <h3 className="text-sm font-bold text-charcoal-900">Recent Collection Requests</h3>
            </div>
            <Link
              to="/pickups"
              className="text-xs font-semibold text-periwinkle-700 hover:text-periwinkle-900 inline-flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-50 text-charcoal-500 uppercase tracking-wider font-semibold border-b border-ivory-200">
                <tr>
                  <th className="py-2.5 px-4">Pickup Code</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Priority</th>
                  <th className="py-2.5 px-4">Scheduled Date</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {isPickupsLoading ? (
                  <LoadingSkeleton type="table-row" count={4} />
                ) : recentPickups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-charcoal-400">
                      No pickups recorded in the system yet.
                    </td>
                  </tr>
                ) : (
                  recentPickups.slice(0, 5).map((pickup) => (
                    <tr key={pickup.id} className="hover:bg-ivory-50/50">
                      <td className="py-3 px-4 font-mono font-semibold text-charcoal-900">
                        {pickup.pickup_code}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={pickup.status} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={pickup.priority} />
                      </td>
                      <td className="py-3 px-4 text-charcoal-600">
                        {formatDate(pickup.scheduled_date || pickup.requested_date)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/pickups?id=${pickup.public_id}`}
                          className="text-xs font-medium text-periwinkle-700 hover:underline"
                        >
                          Inspect
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Open Exceptions & Routes Quick View */}
        <div className="space-y-6">
          {/* Open Exceptions Card */}
          <div className="bg-white rounded-xl border border-ivory-300 shadow-subtle p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-800">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-charcoal-900">Operational Exceptions</h3>
              </div>
              <Link
                to="/exceptions"
                className="text-xs font-semibold text-periwinkle-700 hover:text-periwinkle-900"
              >
                Review
              </Link>
            </div>
            {isExceptionsLoading ? (
              <LoadingSkeleton type="text" count={2} />
            ) : openExceptions.length === 0 ? (
              <p className="text-xs text-charcoal-500 py-3">
                All collections and receipts are reconciled with zero open exceptions.
              </p>
            ) : (
              <div className="space-y-2.5">
                {openExceptions.slice(0, 3).map((exc) => (
                  <div key={exc.id} className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-xs">
                    <div className="flex items-center justify-between font-semibold text-amber-900">
                      <span>{exc.exception_type}</span>
                      <StatusBadge status={exc.status} size="sm" />
                    </div>
                    <p className="mt-1 text-charcoal-700 line-clamp-1">{exc.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Routes Card */}
          <div className="bg-white rounded-xl border border-ivory-300 shadow-subtle p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-periwinkle-700" />
                <h3 className="text-sm font-bold text-charcoal-900">Active Routes</h3>
              </div>
              <Link
                to="/routes"
                className="text-xs font-semibold text-periwinkle-700 hover:text-periwinkle-900"
              >
                Inspect
              </Link>
            </div>
            {isRoutesLoading ? (
              <LoadingSkeleton type="text" count={2} />
            ) : activeRoutes.length === 0 ? (
              <p className="text-xs text-charcoal-500 py-3">
                No active routes currently in progress.
              </p>
            ) : (
              <div className="space-y-2">
                {activeRoutes.slice(0, 3).map((route) => (
                  <div key={route.id} className="flex items-center justify-between p-2 rounded-lg bg-ivory-50 text-xs">
                    <div>
                      <span className="font-mono font-semibold text-charcoal-900">{route.route_code}</span>
                      <span className="block text-[11px] text-charcoal-500">
                        {route.stops?.length || 0} stops assigned
                      </span>
                    </div>
                    <StatusBadge status={route.status} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
