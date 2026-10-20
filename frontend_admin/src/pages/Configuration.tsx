import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configurationApi } from '../api/operations';
import {
  ConfigurationResponse,
  ConfigurationDetailResponse,
  ConfigurationVersionResponse,
  ConfigurationChangeResponse,
  ConfigurationAuditResponse,
  ConfigurationRollbackCreate,
  JsonValue,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { formatDate, formatDateTime } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { Sliders, Plus, History, Check, X, Undo2, CheckCircle2, AlertCircle } from 'lucide-react';

function parseConfigurationValue(dataType: string, rawValue: string): JsonValue {
  switch (dataType) {
    case 'STRING':
      return rawValue;
    case 'INTEGER': {
      const value = Number(rawValue);
      if (rawValue.trim() === '' || !Number.isInteger(value)) {
        throw new Error('This configuration requires an integer value.');
      }
      return value;
    }
    case 'DECIMAL': {
      const value = Number(rawValue);
      if (rawValue.trim() === '' || !Number.isFinite(value)) {
        throw new Error('This configuration requires a decimal number.');
      }
      return value;
    }
    case 'BOOLEAN': {
      const value = rawValue.trim().toLowerCase();
      if (['true', '1', 'yes'].includes(value)) return true;
      if (['false', '0', 'no'].includes(value)) return false;
      throw new Error('This configuration requires true or false.');
    }
    case 'JSON':
      return JSON.parse(rawValue) as JsonValue;
    default:
      throw new Error(`Unsupported configuration data type: ${dataType}`);
  }
}

export const Configuration: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'configs' | 'changes' | 'audit'>('configs');
  const [selectedConfig, setSelectedConfig] = useState<ConfigurationResponse | null>(null);
  const [selectedConfigDetail, setSelectedConfigDetail] = useState<ConfigurationDetailResponse | null>(null);
  const [configHistory, setConfigHistory] = useState<ConfigurationVersionResponse[]>([]);
  const [selectedChange, setSelectedChange] = useState<ConfigurationChangeResponse | null>(null);
  const [rollbackVersion, setRollbackVersion] = useState<ConfigurationVersionResponse | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackReference, setRollbackReference] = useState('');
  const [rollbackEffectiveFrom, setRollbackEffectiveFrom] = useState('');

  // Propose change modal
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [targetConfigId, setTargetConfigId] = useState<number | ''>('');
  const [proposedValue, setProposedValue] = useState('');
  const [riskLevel, setRiskLevel] = useState('HIGH');
  const [changeReason, setChangeReason] = useState('');
  const [changeReference, setChangeReference] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');

  // Review modal
  const [reviewChange, setReviewChange] = useState<ConfigurationChangeResponse | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: configs = [], isLoading: isConfigsLoading } = useQuery({
    queryKey: ['adminConfigurations'],
    queryFn: configurationApi.list,
  });

  const { data: changes = [], isLoading: isChangesLoading } = useQuery({
    queryKey: ['adminChangeRequests'],
    queryFn: configurationApi.listChangeRequests,
  });

  const { data: auditLogs = [], isLoading: isAuditLoading } = useQuery({
    queryKey: ['adminConfigAudit'],
    queryFn: configurationApi.listAuditLogs,
  });

  const proposeMutation = useMutation({
    mutationFn: configurationApi.createChangeRequest,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminChangeRequests'] });
      setAlert({
        type: 'success',
        message: `Change request #${data.id} proposed with status ${data.status}.`,
      });
      setShowChangeModal(false);
      setProposedValue('');
      setChangeReason('');
      setChangeReference('');
      setEffectiveFrom('');
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment?: string }) =>
      configurationApi.approveChangeRequest(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminChangeRequests'] });
      queryClient.invalidateQueries({ queryKey: ['adminConfigurations'] });
      queryClient.invalidateQueries({ queryKey: ['adminConfigAudit'] });
      setAlert({ type: 'success', message: 'Configuration change approved and scheduled for activation.' });
      setReviewChange(null);
      setReviewComment('');
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      configurationApi.rejectChangeRequest(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminChangeRequests'] });
      setAlert({ type: 'success', message: 'Configuration change rejected.' });
      setReviewChange(null);
      setReviewComment('');
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: ({
      configurationId,
      payload,
    }: {
      configurationId: number;
      payload: ConfigurationRollbackCreate;
    }) => configurationApi.rollback(configurationId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminChangeRequests'] });
      queryClient.invalidateQueries({ queryKey: ['adminConfigurations'] });
      queryClient.invalidateQueries({ queryKey: ['adminConfigAudit'] });
      setAlert({
        type: 'success',
        message: `Rollback request #${data.id} submitted for approval.`,
      });
      setRollbackVersion(null);
      setRollbackReason('');
      setRollbackReference('');
      setRollbackEffectiveFrom('');
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const handleInspectConfig = async (cfg: ConfigurationResponse) => {
    setSelectedConfig(cfg);
    setSelectedConfigDetail(null);
    setConfigHistory([]);
    try {
      const [detail, history] = await Promise.all([
        configurationApi.getDetail(cfg.key),
        configurationApi.getHistory(cfg.key),
      ]);
      setSelectedConfigDetail(detail);
      setConfigHistory(history.versions);
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    }
  };

  const formatJson = (value: JsonValue): string => JSON.stringify(value) ?? 'null';
  const targetDataType = configs.find((config) => config.id === targetConfigId)?.data_type || '';

  const configColumns: Column<ConfigurationResponse>[] = [
    {
      key: 'key',
      header: 'Parameter Key',
      sortable: true,
      render: (c) => <span className="font-mono font-bold text-charcoal-900">{c.key}</span>,
    },
    {
      key: 'data_type',
      header: 'Type',
      render: (c) => <span className="text-xs text-charcoal-500 font-medium">{c.data_type}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (c) => <span className="text-xs text-charcoal-700 line-clamp-1">{c.description || '—'}</span>,
    },
    {
      key: 'is_active',
      header: 'Active',
      render: (c) => <StatusBadge status={c.is_active ? 'ACTIVE' : 'INACTIVE'} />,
    },
  ];

  const changeColumns: Column<ConfigurationChangeResponse>[] = [
    {
      key: 'id',
      header: 'Req ID',
      sortable: true,
      render: (ch) => <span className="font-mono font-bold text-charcoal-900">CR-#{ch.id}</span>,
    },
    {
      key: 'proposed_value',
      header: 'Proposed Value',
      render: (ch) => <span className="font-mono font-semibold text-charcoal-900">{formatJson(ch.proposed_value)}</span>,
    },
    {
      key: 'risk_level',
      header: 'Risk Level',
      sortable: true,
      render: (ch) => <StatusBadge status={ch.risk_level} size="sm" />,
    },
    {
      key: 'status',
      header: 'Review Status',
      sortable: true,
      render: (ch) => <StatusBadge status={ch.status} />,
    },
    {
      key: 'reason',
      header: 'Operational Reason',
      render: (ch) => <span className="text-xs text-charcoal-700 line-clamp-1">{ch.reason}</span>,
    },
    {
      key: 'created_at',
      header: 'Submitted',
      render: (ch) => <span>{formatDate(ch.created_at)}</span>,
    },
    {
      key: 'effective_from',
      header: 'Effective From',
      render: (ch) => <span>{formatDateTime(ch.effective_from)}</span>,
    },
    {
      key: 'actions',
      header: 'Review',
      className: 'text-right',
      render: (ch) =>
        ch.status === 'PENDING_APPROVAL' ? (
          <button
            onClick={() => {
              setReviewChange(ch);
              setReviewComment('');
            }}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-periwinkle-100 text-periwinkle-800 hover:bg-periwinkle-200 transition-colors"
          >
            Review
          </button>
        ) : (
          <span className="text-xs text-charcoal-400">Done</span>
        ),
    },
  ];

  const auditColumns: Column<ConfigurationAuditResponse>[] = [
    {
      key: 'id',
      header: 'Audit ID',
      sortable: true,
      render: (a) => <span className="font-mono font-bold text-charcoal-900">AUD-#{a.id}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (a) => <StatusBadge status={a.action} size="sm" />,
    },
    {
      key: 'values',
      header: 'Transition (Prev → New)',
      render: (a) => (
        <span className="font-mono text-xs text-charcoal-700">
          {formatJson(a.old_value)} → {formatJson(a.new_value)}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (a) => <span className="text-xs text-charcoal-700 line-clamp-1">{a.reason || '—'}</span>,
    },
    {
      key: 'created_at',
      header: 'Timestamp',
      sortable: true,
      render: (a) => <span>{formatDateTime(a.created_at)}</span>,
    },
    {
      key: 'configuration_id',
      header: 'Configuration / Actor',
      render: (a) => <span>#{a.configuration_id} / User #{a.actor_id}</span>,
    },
    {
      key: 'relations',
      header: 'Version / Request',
      render: (a) => (
        <span>
          {a.configuration_version_id ?? '—'} / {a.change_request_id ?? '—'}
        </span>
      ),
    },
    {
      key: 'change_reference',
      header: 'Reference',
      render: (a) => <span>{a.change_reference || '—'}</span>,
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
          <h2 className="text-xl font-bold text-charcoal-900 tracking-tight">System Configuration & Audit</h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Operational tolerances, route optimizer thresholds, and 4-eye approval change workflows.
          </p>
        </div>
        <button
          onClick={() => setShowChangeModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Propose Change Request</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-ivory-300">
        <button
          onClick={() => setActiveTab('configs')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'configs'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <Sliders className="w-4 h-4 text-periwinkle-700" />
          <span>Active Parameters ({configs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('changes')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'changes'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <span>Change Requests ({changes.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'audit'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <History className="w-4 h-4 text-periwinkle-700" />
          <span>Audit Log ({auditLogs.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'configs' && (
        <DataTable
          columns={configColumns}
          data={configs}
          isLoading={isConfigsLoading}
          searchPlaceholder="Filter parameter key, description..."
          searchFilter={(row, q) =>
            row.key.toLowerCase().includes(q) || (row.description || '').toLowerCase().includes(q)
          }
          onRowClick={(cfg) => handleInspectConfig(cfg)}
        />
      )}

      {activeTab === 'changes' && (
        <DataTable
          columns={changeColumns}
          data={changes}
          isLoading={isChangesLoading}
          searchPlaceholder="Filter change requests by reason, reference..."
          searchFilter={(row, q) =>
            row.reason.toLowerCase().includes(q) ||
            (row.change_reference || '').toLowerCase().includes(q) ||
            row.status.toLowerCase().includes(q)
          }
          onRowClick={(change) => setSelectedChange(change)}
        />
      )}

      {activeTab === 'audit' && (
        <DataTable
          columns={auditColumns}
          data={auditLogs}
          isLoading={isAuditLoading}
          searchPlaceholder="Search audit log..."
          searchFilter={(row, q) =>
            Boolean(
              row.action.toLowerCase().includes(q) ||
              (row.reason && row.reason.toLowerCase().includes(q))
            )
          }

        />
      )}

      {/* Configuration Detail & Version History Drawer */}
      <DetailDrawer
        isOpen={!!selectedConfig}
        onClose={() => {
          setSelectedConfig(null);
          setSelectedConfigDetail(null);
        }}
        title={selectedConfigDetail?.key || selectedConfig?.key || 'Parameter Detail'}
        subtitle={selectedConfigDetail?.description || selectedConfig?.description || undefined}
      >
        {selectedConfig && (
          <div className="space-y-6 text-xs">
            <div className="p-4 bg-ivory-100 rounded-xl flex items-center justify-between border border-ivory-300">
              <div>
                <span className="text-charcoal-500 block">Current Active Value</span>
                <span className="text-lg font-mono font-bold text-charcoal-900">
                  {selectedConfigDetail?.current_version
                    ? formatJson(selectedConfigDetail.current_version.value)
                    : 'Unset'}
                </span>
              </div>
              <StatusBadge status={selectedConfig.is_active ? 'ACTIVE' : 'INACTIVE'} size="md" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-charcoal-700">
              <span>Configuration ID: #{selectedConfig.id}</span>
              <span>Data type: {selectedConfig.data_type}</span>
              <span>Scope: {selectedConfig.scope}</span>
              <span>Scope ID: {selectedConfig.scope_id ?? '—'}</span>
              <span>Current version ID: {selectedConfig.current_version_id ?? '—'}</span>
              <span>Created: {formatDateTime(selectedConfig.created_at)}</span>
              <span>Updated: {formatDateTime(selectedConfig.updated_at)}</span>
            </div>

            <div>
              <h4 className="font-bold text-charcoal-900 uppercase tracking-wider mb-2">Version History</h4>
              {configHistory.length === 0 ? (
                <p className="text-charcoal-400">No previous version history recorded.</p>
              ) : (
                <div className="space-y-2.5">
                  {configHistory.map((v) => (
                    <div key={v.id} className="p-3 bg-white rounded-lg border border-ivory-300 space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-charcoal-900">v{v.version}: {formatJson(v.value)}</span>
                        <StatusBadge status={v.status} size="sm" />
                      </div>
                      <span className="text-[11px] text-charcoal-500 block">
                        Effective: {formatDateTime(v.effective_from)} — {formatDateTime(v.effective_until)}
                      </span>
                      <span className="text-[11px] text-charcoal-500 block">
                        Created by User #{v.created_by} at {formatDateTime(v.created_at)} · Approved by{' '}
                        {v.approved_by ?? '—'} at {formatDateTime(v.approved_at)}
                      </span>
                      <span className="text-[11px] text-charcoal-500 block">
                        Reason: {v.reason || '—'} · Reference: {v.change_reference || '—'}
                      </span>
                      <span className="text-[11px] text-charcoal-500 block">
                        Previous version: {v.previous_version_id ?? '—'} · Rollback of: {v.rollback_of_version_id ?? '—'}
                      </span>
                      {selectedConfig.current_version_id !== v.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setRollbackVersion(v);
                            setRollbackReason('');
                            setRollbackReference('');
                            setRollbackEffectiveFrom('');
                          }}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-ivory-100 px-2.5 py-1 font-semibold text-charcoal-800 hover:bg-ivory-200"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Request rollback to v{v.version}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer
        isOpen={!!selectedChange}
        onClose={() => setSelectedChange(null)}
        title={`Change Request #${selectedChange?.id}`}
        subtitle={selectedChange?.status}
      >
        {selectedChange && (
          <div className="space-y-3 text-xs text-charcoal-800">
            <div><b>Configuration / Base version:</b> #{selectedChange.configuration_id} / {selectedChange.base_version_id ?? '—'}</div>
            <div><b>Proposed value:</b> <pre className="whitespace-pre-wrap break-all">{formatJson(selectedChange.proposed_value)}</pre></div>
            <div><b>Status / Risk:</b> {selectedChange.status} / {selectedChange.risk_level}</div>
            <div><b>Reason:</b> {selectedChange.reason}</div>
            <div><b>Reference:</b> {selectedChange.change_reference || '—'}</div>
            <div><b>Effective from:</b> {formatDateTime(selectedChange.effective_from)}</div>
            <div><b>Created by / at:</b> User #{selectedChange.created_by} / {formatDateTime(selectedChange.created_at)}</div>
            <div><b>Approved by / Rejected by:</b> {selectedChange.approved_by ?? '—'} / {selectedChange.rejected_by ?? '—'}</div>
            <div><b>Reviewed at:</b> {formatDateTime(selectedChange.reviewed_at)}</div>
            <div><b>Review comment:</b> {selectedChange.review_comment || '—'}</div>
            <div><b>Rollback of version:</b> {selectedChange.rollback_of_version_id ?? '—'}</div>
          </div>
        )}
      </DetailDrawer>

      {/* Propose Change Modal */}
      <Modal
        isOpen={showChangeModal}
        onClose={() => setShowChangeModal(false)}
        title="Propose Runtime Configuration Change"
        subtitle="Requires 4-eye administrative review before activation"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              targetConfigId &&
              (targetDataType === 'STRING' || proposedValue.trim()) &&
              changeReason.trim()
            ) {
              let parsedValue: JsonValue;
              try {
                parsedValue = parseConfigurationValue(targetDataType, proposedValue);
              } catch (err) {
                setAlert({
                  type: 'error',
                  message: err instanceof Error ? err.message : 'Unable to parse the configuration value.',
                });
                return;
              }
              proposeMutation.mutate({
                configuration_id: Number(targetConfigId),
                proposed_value: parsedValue,
                risk_level: riskLevel,
                reason: changeReason.trim(),
                change_reference: changeReference.trim() || null,
                effective_from: effectiveFrom ? new Date(effectiveFrom).toISOString() : null,
              });
            }
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Target Parameter
            </label>
            <select
              required
              value={targetConfigId}
              onChange={(e) => {
                setTargetConfigId(e.target.value === '' ? '' : Number(e.target.value));
                setProposedValue('');
              }}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="">Select parameter to modify...</option>
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.key} (Current version ID: {c.current_version_id ?? 'Unset'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Proposed Value {targetDataType && `(${targetDataType})`}
              </label>
              <textarea
                required={targetDataType !== 'STRING'}
                rows={3}
                placeholder={
                  targetDataType === 'JSON'
                    ? 'Enter valid JSON'
                    : targetDataType === 'BOOLEAN'
                      ? 'true or false'
                      : 'Enter the configured value'
                }
                value={proposedValue}
                onChange={(e) => setProposedValue(e.target.value)}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Assessed Risk
              </label>
              <input
                type="text"
                required
                maxLength={20}
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Change Reference
              </label>
              <input
                type="text"
                maxLength={150}
                placeholder="RFC-2026-081"
                value={changeReference}
                onChange={(e) => setChangeReference(e.target.value)}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Reason / Justification
              </label>
              <input
                required
                type="text"
                maxLength={2000}
                placeholder="Operational policy change..."
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Effective From (Optional)
            </label>
            <input
              type="datetime-local"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setShowChangeModal(false)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={proposeMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {proposeMutation.isPending ? 'Submitting...' : 'Submit Change Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Review Modal */}
      <Modal
        isOpen={!!reviewChange}
        onClose={() => setReviewChange(null)}
        title={`Review Change Request CR-#${reviewChange?.id}`}
        subtitle={`Proposed Value: ${reviewChange ? formatJson(reviewChange.proposed_value) : ''}`}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-ivory-100 rounded-lg space-y-1">
            <span className="text-charcoal-500 font-medium">Risk Level</span>
            <div className="flex items-center gap-2">
              <StatusBadge status={reviewChange?.risk_level} size="sm" />
              <span className="text-charcoal-700">Ref: {reviewChange?.change_reference || '—'}</span>
            </div>
            <p className="text-charcoal-800 mt-2">Reason: {reviewChange?.reason}</p>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Reviewer Audit Comment
            </label>
            <input
              type="text"
              maxLength={2000}
              placeholder="Approval or rejection notes..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              onClick={() => {
                if (reviewChange) {
                  rejectMutation.mutate({ id: reviewChange.id, comment: reviewComment.trim() });
                }
              }}
              disabled={rejectMutation.isPending || !reviewComment.trim()}
              className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              Reject Change
            </button>
            <button
              onClick={() => {
                if (reviewChange) {
                  approveMutation.mutate({ id: reviewChange.id, comment: reviewComment.trim() || undefined });
                }
              }}
              disabled={approveMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-emerald-400 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              Approve & Apply
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!rollbackVersion}
        onClose={() => setRollbackVersion(null)}
        title={`Request Rollback to Version ${rollbackVersion?.version ?? ''}`}
        subtitle="Rollback requests require the same approval workflow as configuration changes."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!rollbackVersion || !rollbackReason.trim()) return;
            rollbackMutation.mutate({
              configurationId: rollbackVersion.configuration_id,
              payload: {
                rollback_to_version_id: rollbackVersion.id,
                reason: rollbackReason.trim(),
                change_reference: rollbackReference.trim() || null,
                effective_from: rollbackEffectiveFrom
                  ? new Date(rollbackEffectiveFrom).toISOString()
                  : null,
              },
            });
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Rollback Reason
            </label>
            <textarea
              required
              minLength={1}
              maxLength={2000}
              rows={3}
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Change Reference (Optional)
            </label>
            <input
              type="text"
              maxLength={150}
              value={rollbackReference}
              onChange={(e) => setRollbackReference(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Effective From (Optional)
            </label>
            <input
              type="datetime-local"
              value={rollbackEffectiveFrom}
              onChange={(e) => setRollbackEffectiveFrom(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-ivory-200 pt-4">
            <button
              type="button"
              onClick={() => setRollbackVersion(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rollbackMutation.isPending || !rollbackReason.trim()}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg disabled:opacity-50"
            >
              {rollbackMutation.isPending ? 'Submitting...' : 'Submit Rollback Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
