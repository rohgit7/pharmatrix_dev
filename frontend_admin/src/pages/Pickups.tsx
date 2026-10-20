import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pickupsApi } from '../api/operations';
import { PickupAdminResponse, PickupStatus } from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { Modal } from '../components/common/Modal';
import { formatDate, formatDateTime } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { Calendar, XCircle, CheckCircle2, AlertCircle, Eye, Clock } from 'lucide-react';

export const Pickups: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedPickup, setSelectedPickup] = useState<PickupAdminResponse | null>(null);

  // Schedule Modal State
  const [scheduleModalPickup, setScheduleModalPickup] = useState<PickupAdminResponse | null>(null);
  const [scheduledDate, setScheduledDate] = useState<string>('');

  // Cancel Dialog State
  const [cancelModalPickup, setCancelModalPickup] = useState<PickupAdminResponse | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Notification / Alert message
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: pickups = [], isLoading, error } = useQuery({
    queryKey: ['adminPickups', statusFilter],
    queryFn: () => pickupsApi.list(statusFilter === 'ALL' ? undefined : (statusFilter as PickupStatus)),
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      pickupsApi.schedule(id, new Date(date).toISOString()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPickups'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardSummary'] });
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
      queryClient.invalidateQueries({ queryKey: ['adminPickups'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardSummary'] });
      setAlert({ type: 'success', message: 'Pickup was cancelled successfully.' });
      setCancelModalPickup(null);
      setCancelReason('');
      if (selectedPickup) setSelectedPickup(null);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleModalPickup || !scheduledDate) return;
    scheduleMutation.mutate({ id: scheduleModalPickup.public_id, date: scheduledDate });
  };

  const handleCancelSubmit = () => {
    if (!cancelModalPickup || !cancelReason.trim()) return;
    cancelMutation.mutate({ id: cancelModalPickup.public_id, reason: cancelReason.trim() });
  };

  const columns: Column<PickupAdminResponse>[] = [
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
      header: 'Status',
      sortable: true,
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (p) => <StatusBadge status={p.priority} size="sm" />,
    },
    {
      key: 'customer_id',
      header: 'Customer ID',
      sortable: true,
      render: (p) => (
        <span className="text-charcoal-700 font-mono text-xs">CUST-#{p.customer_id}</span>
      ),
    },
    {
      key: 'location_id',
      header: 'Location ID',
      render: (p) => (
        <span className="text-charcoal-600 font-mono text-xs">LOC-#{p.location_id}</span>
      ),
    },
    {
      key: 'scheduled_date',
      header: 'Scheduled / Req Date',
      sortable: true,
      render: (p) => (
        <div>
          <span className="block font-medium">{formatDate(p.scheduled_date || p.requested_date)}</span>
          <span className="block text-[11px] text-charcoal-400">
            {p.scheduled_date ? 'Scheduled' : 'Requested'}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (p) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedPickup(p)}
            className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Inspect Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {p.status === 'REQUESTED' && (
            <button
              onClick={() => {
                setScheduleModalPickup(p);
                setScheduledDate('');
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-periwinkle-100 text-periwinkle-800 hover:bg-periwinkle-200 transition-colors"
            >
              Schedule
            </button>
          )}
          {['REQUESTED', 'SCHEDULED'].includes(p.status) && (
            <button
              onClick={() => {
                setCancelModalPickup(p);
                setCancelReason('');
              }}
              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
              title="Cancel Pickup"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const statusOptions = ['ALL', 'REQUESTED', 'SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'COLLECTED', 'CANCELLED', 'FAILED'];

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {alert && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{alert.message}</span>
          </div>
          <button
            onClick={() => setAlert(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-charcoal-900 tracking-tight">Pharmaceutical Waste Pickups</h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Manage generator collection requests, verify scheduling windows, and enforce custody compliance.
          </p>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={pickups}
        isLoading={isLoading}
        searchPlaceholder="Filter by pickup code, customer ID..."
        searchFilter={(row, q) =>
          row.pickup_code.toLowerCase().includes(q) ||
          String(row.customer_id).includes(q) ||
          String(row.location_id).includes(q) ||
          row.status.toLowerCase().includes(q)
        }
        filterSlot={
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {statusOptions.map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-charcoal-800 text-white border-charcoal-800'
                    : 'bg-white text-charcoal-600 border-ivory-300 hover:bg-ivory-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        }
        onRowClick={(p) => setSelectedPickup(p)}
      />

      {/* Inspection Drawer */}
      <DetailDrawer
        isOpen={!!selectedPickup}
        onClose={() => setSelectedPickup(null)}
        title={selectedPickup?.pickup_code || 'Pickup Details'}
        subtitle={`System ID: #${selectedPickup?.id}`}
      >
        {selectedPickup && (
          <div className="space-y-6 text-sm">
            {/* Status overview */}
            <div className="bg-ivory-100 p-4 rounded-xl border border-ivory-300 flex items-center justify-between">
              <div>
                <span className="text-xs text-charcoal-500 block font-medium">Lifecycle Status</span>
                <div className="mt-1">
                  <StatusBadge status={selectedPickup.status} size="md" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-charcoal-500 block font-medium">Priority</span>
                <div className="mt-1">
                  <StatusBadge status={selectedPickup.priority} size="md" />
                </div>
              </div>
            </div>

            {/* Properties List */}
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-ivory-200">
                <span className="text-charcoal-500 text-xs">Public Identifier (UUID)</span>
                <span className="font-mono text-xs text-charcoal-900 select-all">
                  {selectedPickup.public_id}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-ivory-200">
                <span className="text-charcoal-500 text-xs">Customer Organization</span>
                <span className="font-semibold text-charcoal-900">
                  Customer #{selectedPickup.customer_id}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-ivory-200">
                <span className="text-charcoal-500 text-xs">Pickup Location</span>
                <span className="font-medium text-charcoal-900">
                  Location ID #{selectedPickup.location_id}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-ivory-200">
                <span className="text-charcoal-500 text-xs">Requested Date</span>
                <span className="text-charcoal-800">{formatDateTime(selectedPickup.requested_date)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-ivory-200">
                <span className="text-charcoal-500 text-xs">Scheduled Collection</span>
                <span className="font-semibold text-charcoal-900">
                  {formatDateTime(selectedPickup.scheduled_date)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-ivory-200">
                <span className="text-charcoal-500 text-xs">Collection Timestamp</span>
                <span className="text-charcoal-800">{formatDateTime(selectedPickup.collected_at)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-ivory-200">
                <span className="text-charcoal-500 text-xs">Created At</span>
                <span className="text-charcoal-800">{formatDateTime(selectedPickup.created_at)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-ivory-200">
                <span className="text-charcoal-500 text-xs">Last Updated</span>
                <span className="text-charcoal-800">{formatDateTime(selectedPickup.updated_at)}</span>
              </div>
            </div>

            {/* Notes & Failure Reason */}
            {selectedPickup.notes && (
              <div className="p-3 bg-ivory-50 rounded-lg border border-ivory-200">
                <span className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider block mb-1">
                  Customer Instructions
                </span>
                <p className="text-xs text-charcoal-800 leading-relaxed">{selectedPickup.notes}</p>
              </div>
            )}

            {selectedPickup.failure_reason && (
              <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider block mb-1">
                  Cancellation / Failure Reason
                </span>
                <p className="text-xs text-rose-900 leading-relaxed">
                  {selectedPickup.failure_reason}
                </p>
              </div>
            )}

            {/* Operational Actions */}
            <div className="pt-4 border-t border-ivory-200 flex items-center justify-end gap-3">
              {selectedPickup.status === 'REQUESTED' && (
                <button
                  onClick={() => {
                    setScheduleModalPickup(selectedPickup);
                    setScheduledDate('');
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 shadow-sm transition-colors"
                >
                  Schedule Collection
                </button>
              )}
              {['REQUESTED', 'SCHEDULED'].includes(selectedPickup.status) && (
                <button
                  onClick={() => {
                    setCancelModalPickup(selectedPickup);
                    setCancelReason('');
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                >
                  Cancel Pickup
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
        subtitle={`Assign operational date for ${scheduleModalPickup?.pickup_code}`}
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1.5">
              Scheduled Collection Date & Time
            </label>
            <input
              type="datetime-local"
              required
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:outline-none focus:ring-2 focus:ring-periwinkle"
            />
            <p className="mt-1 text-xs text-charcoal-400">
              The customer will receive an automated scheduling notification.
            </p>
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

      {/* Cancel Dialog */}
      <Modal
        isOpen={!!cancelModalPickup}
        onClose={() => setCancelModalPickup(null)}
        title="Cancel Consignment Pickup"
        subtitle={`Provide an auditable cancellation reason for ${cancelModalPickup?.pickup_code}.`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCancelSubmit();
          }}
          className="space-y-4"
        >
          <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider">
            Cancellation Reason
            <textarea
              required
              minLength={1}
              maxLength={1000}
              rows={4}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </label>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setCancelModalPickup(null)}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 text-xs font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg"
            >
              Keep Pickup
            </button>
            <button
              type="submit"
              disabled={cancelMutation.isPending || !cancelReason.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Pickup'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
