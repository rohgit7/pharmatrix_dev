import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { exceptionsApi, routesApi } from '../api/operations';
import {
  OperationalExceptionResponse,
  OperationalExceptionStatus,
  OperationalExceptionType,
  OperationalExceptionCreate,
  OperationalExceptionUpdate,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { Modal } from '../components/common/Modal';
import { formatDateTime, formatDate } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { ErrorState } from '../components/common/ErrorState';
import {
  AlertOctagon,
  CheckCircle2,
  AlertCircle,
  Eye,
  ExternalLink,
  Image as ImageIcon,
  Plus,
  Edit,
  Trash2,
  ArrowUpRight,
  X,
} from 'lucide-react';

const statusOptions: Array<OperationalExceptionStatus | 'ALL'> = [
  'ALL',
  'OPEN',
  'ESCALATED',
  'RESOLVED',
];

export const Exceptions: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStatus = searchParams.get('status');
  const statusFilter = statusOptions.includes(requestedStatus as OperationalExceptionStatus)
    ? (requestedStatus as OperationalExceptionStatus)
    : 'ALL';
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedException, setSelectedException] = useState<OperationalExceptionResponse | null>(null);

  // Resolution modal
  const [resolveExceptionId, setResolveExceptionId] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Admin CRUD Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [exceptionToEdit, setExceptionToEdit] = useState<OperationalExceptionResponse | null>(null);
  const [exceptionToDelete, setExceptionToDelete] = useState<OperationalExceptionResponse | null>(null);

  const [createForm, setCreateForm] = useState<{
    exception_type: OperationalExceptionType;
    source_type: string;
    source_id: string;
    reason: string;
  }>({
    exception_type: 'PICKUP_FAILED',
    source_type: 'ROUTE_STOP',
    source_id: '',
    reason: '',
  });

  const [editForm, setEditForm] = useState<{
    status: OperationalExceptionStatus;
    reason: string;
    resolution_notes: string;
  }>({
    status: 'OPEN',
    reason: '',
    resolution_notes: '',
  });

  // Proof inspection
  const [proofStopId, setProofStopId] = useState<number | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofExpiresIn, setProofExpiresIn] = useState<number | null>(null);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [proofStopInput, setProofStopInput] = useState('');
  const [proofLoading, setProofLoading] = useState(false);

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const updateStatusFilter = (status: OperationalExceptionStatus | 'ALL') => {
    const nextParams = new URLSearchParams(searchParams);
    if (status === 'ALL') {
      nextParams.delete('status');
    } else {
      nextParams.set('status', status);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const { data: exceptions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['adminExceptions', statusFilter, typeFilter],
    queryFn: () =>
      exceptionsApi.list({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as OperationalExceptionStatus),
        exception_type: typeFilter === 'ALL' ? undefined : (typeFilter as OperationalExceptionType),
      }),
  });

  const createExceptionMutation = useMutation({
    mutationFn: (payload: OperationalExceptionCreate) => exceptionsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminExceptions'] });
      setAlert({ type: 'success', message: 'Operational exception logged successfully.' });
      setShowCreateModal(false);
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const escalateMutation = useMutation({
    mutationFn: (id: number) => exceptionsApi.escalate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminExceptions'] });
      setAlert({ type: 'success', message: 'Exception escalated to critical management attention.' });
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const updateExceptionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: OperationalExceptionUpdate }) =>
      exceptionsApi.update(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminExceptions'] });
      setAlert({ type: 'success', message: 'Exception record updated.' });
      setExceptionToEdit(null);
      if (selectedException?.id === data.id) setSelectedException(data);
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const deleteExceptionMutation = useMutation({
    mutationFn: (id: number) => exceptionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminExceptions'] });
      setAlert({ type: 'success', message: 'Operational exception deleted.' });
      setExceptionToDelete(null);
      if (selectedException?.id === exceptionToDelete?.id) setSelectedException(null);
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      exceptionsApi.resolve(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminExceptions'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardSummary'] });
      setAlert({ type: 'success', message: 'Operational exception marked as resolved.' });
      setResolveExceptionId(null);
      setResolutionNotes('');
      if (selectedException) setSelectedException(null);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const handleFetchProof = async (stopId: number) => {
    setProofLoading(true);
    setProofStopId(stopId);
    try {
      const res = await routesApi.getProofUrl(stopId);
      setProofUrl(res.signed_url);
      setProofStopId(res.stop_id);
      setProofExpiresIn(res.expires_in);
      setProofUploaded(res.proof_uploaded);
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err) });
      setProofStopId(null);
    } finally {
      setProofLoading(false);
    }
  };

  const columns: Column<OperationalExceptionResponse>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      render: (e) => <span className="font-mono font-bold text-charcoal-900">EXC-#{e.id}</span>,
    },
    {
      key: 'exception_type',
      header: 'Exception Type',
      sortable: true,
      render: (e) => (
        <span className="font-semibold text-charcoal-900 text-xs">{e.exception_type}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (e) => <StatusBadge status={e.status} />,
    },
    {
      key: 'source',
      header: 'Source Origin',
      render: (e) => (
        <span className="font-mono text-xs text-charcoal-600">
          {e.source_type} #{e.source_id}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (e) => (
        <span className="text-xs text-charcoal-700 line-clamp-1 max-w-xs">{e.reason}</span>
      ),
    },
    {
      key: 'opened_at',
      header: 'Opened At',
      sortable: true,
      render: (e) => <span>{formatDateTime(e.opened_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (e) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(ev) => ev.stopPropagation()}>
          <button
            onClick={() => setSelectedException(e)}
            className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Inspect"
          >
            <Eye className="w-4 h-4" />
          </button>
          {e.status === 'OPEN' && (
            <button
              onClick={() => escalateMutation.mutate(e.id)}
              disabled={escalateMutation.isPending}
              className="p-1.5 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-colors"
              title="Escalate Exception"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
          {e.status !== 'RESOLVED' && (
            <button
              onClick={() => {
                setResolveExceptionId(e.id);
                setResolutionNotes('');
              }}
              className="px-2 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
              title="Resolve Exception"
            >
              Resolve
            </button>
          )}
          <button
            onClick={() => {
              setExceptionToEdit(e);
              setEditForm({
                status: e.status,
                reason: e.reason,
                resolution_notes: e.resolution_notes || '',
              });
            }}
            className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Edit Exception"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExceptionToDelete(e)}
            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
            title="Delete Exception"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Alert */}
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
          <button onClick={() => setAlert(null)} className="text-xs font-bold opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-charcoal-900 tracking-tight">
            Operational Exceptions & Proofs
          </h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Audit collection discrepancies, auto-escalations, and verify digital proof of collection photos.
          </p>
        </div>
        <button
          onClick={() => {
            setCreateForm({
              exception_type: 'PICKUP_FAILED',
              source_type: 'ROUTE_STOP',
              source_id: '',
              reason: '',
            });
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Report Exception
        </button>
      </div>

      {/* Proof Lookup Quick Card */}
      <div className="bg-white p-4 rounded-xl border border-ivory-300 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-charcoal-800">
          <ImageIcon className="w-4 h-4 text-periwinkle-700" />
          <span className="font-semibold">Need to inspect digital proof of collection for a route stop?</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Route Stop ID (e.g. 1)"
            value={proofStopInput}
            onChange={(e) => setProofStopInput(e.target.value)}
            className="px-3 py-1.5 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle w-36"
          />
          <button
            onClick={() => handleFetchProof(Number(proofStopInput))}
            disabled={proofLoading || !Number.isInteger(Number(proofStopInput)) || Number(proofStopInput) < 1}
            className="px-3 py-1.5 bg-charcoal-800 hover:bg-charcoal-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
          >
            {proofLoading ? 'Loading...' : 'Fetch Photo Proof'}
          </button>
        </div>
      </div>

      {/* Proof URL Modal if fetched */}
      <Modal
        isOpen={!!proofUrl}
        onClose={() => {
          setProofUrl(null);
          setProofStopId(null);
          setProofExpiresIn(null);
          setProofUploaded(false);
        }}
        title={`Collection Proof for Stop #${proofStopId}`}
        subtitle={`Signed storage link · Expires in ${Math.ceil((proofExpiresIn ?? 0) / 60)} minutes`}
      >
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden border border-ivory-300 bg-ivory-100 flex items-center justify-center max-h-96">
            <img
              src={proofUrl || ''}
              alt="Collection proof"
              className="max-h-96 object-contain w-full"
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <a
              href={proofUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-periwinkle-700 hover:underline inline-flex items-center gap-1 font-semibold"
            >
              Open in full resolution <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <span className="text-charcoal-500">
              Stop #{proofStopId} · {proofUploaded ? 'Proof uploaded' : 'No proof'}
            </span>
          </div>
        </div>
      </Modal>

      {/* Table */}
      {error ? (
        <ErrorState
          title="Unable to load exceptions"
          message={error instanceof Error ? error.message : 'An unexpected error occurred.'}
          onRetry={() => { void refetch(); }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={exceptions}
          isLoading={isLoading}
          searchPlaceholder="Filter exceptions by reason, ID..."
          searchFilter={(row, q) =>
            row.reason.toLowerCase().includes(q) ||
            row.exception_type.toLowerCase().includes(q) ||
            String(row.id).includes(q)
          }
          filterSlot={
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => updateStatusFilter(e.target.value as OperationalExceptionStatus | 'ALL')}
                className="px-2.5 py-1 text-xs bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="ESCALATED">Escalated</option>
                <option value="RESOLVED">Resolved</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1 text-xs bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal font-medium"
              >
                <option value="ALL">All Types</option>
                <option value="PICKUP_FAILED">Pickup Failed</option>
                <option value="WAREHOUSE_INTAKE_DISCREPANCY">Intake Discrepancy</option>
                <option value="DISPOSAL_SHIPMENT_DISCREPANCY">Shipment Discrepancy</option>
              </select>
            </div>
          }
          onRowClick={(e) => setSelectedException(e)}
        />
      )}

      {/* Exception Inspection Drawer */}
      <DetailDrawer
        isOpen={!!selectedException}
        onClose={() => setSelectedException(null)}
        title={`Operational Exception #${selectedException?.id}`}
        subtitle={selectedException?.exception_type}
      >
        {selectedException && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-ivory-100 rounded-lg flex items-center justify-between">
              <span className="text-charcoal-500 font-medium">Lifecycle Status</span>
              <StatusBadge status={selectedException.status} size="md" />
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Source Entity</span>
                <span className="font-mono font-bold text-charcoal-900">
                  {selectedException.source_type} #{selectedException.source_id}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Logged At</span>
                <span className="text-charcoal-900">{formatDateTime(selectedException.opened_at)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Escalated At</span>
                <span className="text-charcoal-900">{formatDateTime(selectedException.escalated_at)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Resolved At</span>
                <span className="text-charcoal-900">{formatDateTime(selectedException.resolved_at)}</span>
              </div>
              {selectedException.resolved_by_user_id && (
                <div className="flex justify-between py-1.5 border-b border-ivory-200">
                  <span className="text-charcoal-500">Resolved By User</span>
                  <span className="font-mono text-charcoal-900">
                    User #{selectedException.resolved_by_user_id}
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="font-semibold text-amber-900 block mb-1">Reason / Investigation Flag</span>
              <p className="text-charcoal-800 leading-relaxed">{selectedException.reason}</p>
            </div>

            {selectedException.resolution_notes && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="font-semibold text-emerald-900 block mb-1">Resolution Summary</span>
                <p className="text-charcoal-800 leading-relaxed">{selectedException.resolution_notes}</p>
              </div>
            )}

            {selectedException.status !== 'RESOLVED' && (
              <div className="pt-4 border-t border-ivory-200 flex justify-end">
                <button
                  onClick={() => {
                    setResolveExceptionId(selectedException.id);
                    setResolutionNotes('');
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
                >
                  Resolve Exception
                </button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      {/* Resolution Modal */}
      <Modal
        isOpen={!!resolveExceptionId}
        onClose={() => setResolveExceptionId(null)}
        title="Resolve Operational Exception"
        subtitle={`Closing exception record EXC-#${resolveExceptionId}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (resolveExceptionId && resolutionNotes.trim()) {
              resolveMutation.mutate({ id: resolveExceptionId, notes: resolutionNotes.trim() });
            }
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Resolution Audit Notes (Required)
            </label>
            <textarea
              required
              maxLength={2000}
              rows={3}
              placeholder="Detail corrective action, weight recount verification, or customer acknowledgment..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setResolveExceptionId(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resolveMutation.isPending || !resolutionNotes.trim()}
              className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {resolveMutation.isPending ? 'Saving...' : 'Confirm Resolution'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Exception Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Report Operational Exception"
        subtitle="Log a discrepancy, route failure, or facility escalation"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createExceptionMutation.mutate({
              exception_type: createForm.exception_type,
              source_type: createForm.source_type.trim(),
              source_id: Number(createForm.source_id),
              reason: createForm.reason.trim(),
            });
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Exception Type *</label>
              <select
                value={createForm.exception_type}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    exception_type: e.target.value as OperationalExceptionType,
                  })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="PICKUP_FAILED">Pickup Failed</option>
                <option value="WAREHOUSE_INTAKE_DISCREPANCY">Intake Discrepancy</option>
                <option value="DISPOSAL_SHIPMENT_DISCREPANCY">Shipment Discrepancy</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Source Entity Type *</label>
              <select
                value={createForm.source_type}
                onChange={(e) => setCreateForm({ ...createForm, source_type: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="ROUTE_STOP">ROUTE_STOP</option>
                <option value="PICKUP">PICKUP</option>
                <option value="WAREHOUSE_INTAKE">WAREHOUSE_INTAKE</option>
                <option value="DISPOSAL_SHIPMENT">DISPOSAL_SHIPMENT</option>
                <option value="FACILITY">FACILITY</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Source Entity ID *</label>
            <input
              type="number"
              required
              min="1"
              step="1"
              value={createForm.source_id}
              onChange={(e) => setCreateForm({ ...createForm, source_id: e.target.value })}
              placeholder="e.g. 102"
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Reason / Description *</label>
            <textarea
              required
              rows={3}
              value={createForm.reason}
              onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
              placeholder="Describe the discrepancy or failure observed..."
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createExceptionMutation.isPending || !createForm.reason.trim() || !createForm.source_id}
              className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {createExceptionMutation.isPending ? 'Logging...' : 'Log Exception'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Exception Modal */}
      <Modal
        isOpen={!!exceptionToEdit}
        onClose={() => setExceptionToEdit(null)}
        title={`Edit Exception #${exceptionToEdit?.id}`}
        subtitle={`Type: ${exceptionToEdit?.exception_type} · Source: ${exceptionToEdit?.source_type} #${exceptionToEdit?.source_id}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (exceptionToEdit) {
              updateExceptionMutation.mutate({
                id: exceptionToEdit.id,
                payload: {
                  status: editForm.status,
                  reason: editForm.reason.trim(),
                  resolution_notes: editForm.resolution_notes.trim() || null,
                },
              });
            }
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Status</label>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as OperationalExceptionStatus })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="OPEN">OPEN</option>
              <option value="ESCALATED">ESCALATED</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Reason / Description</label>
            <textarea
              required
              rows={3}
              value={editForm.reason}
              onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Resolution Audit Notes (Optional)</label>
            <textarea
              rows={2}
              value={editForm.resolution_notes}
              onChange={(e) => setEditForm({ ...editForm, resolution_notes: e.target.value })}
              placeholder="Audit remarks, verification details..."
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setExceptionToEdit(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateExceptionMutation.isPending || !editForm.reason.trim()}
              className="px-4 py-2 font-semibold text-white bg-charcoal-900 hover:bg-charcoal-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {updateExceptionMutation.isPending ? 'Saving...' : 'Update Exception'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!exceptionToDelete}
        onClose={() => setExceptionToDelete(null)}
        title="Delete Operational Exception"
        subtitle={`Confirm permanent removal of EXC-#${exceptionToDelete?.id}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-charcoal-700">
            Are you sure you want to delete operational exception <strong className="font-mono text-charcoal-900">EXC-#{exceptionToDelete?.id}</strong>?
            This record and its audit trail will be permanently removed.
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
            <strong>Warning:</strong> Deleting an exception removes the discrepancy history. If the issue is resolved, prefer marking it as <em>Resolved</em> instead.
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setExceptionToDelete(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (exceptionToDelete) {
                  deleteExceptionMutation.mutate(exceptionToDelete.id);
                }
              }}
              disabled={deleteExceptionMutation.isPending}
              className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {deleteExceptionMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
