import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { configurationApi, auditLogsApi } from '../api/operations';
import { ConfigurationAuditResponse, AuditLogResponse, AuditLogItem } from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { formatDateTime } from '../utils/formatters';
import { ErrorState } from '../components/common/ErrorState';
import {
  Shield,
  Eye,
  Search,
  Filter,
  History,
  UserCheck,
  Key,
  Activity,
  FileText,
  CheckCircle2,
  RotateCcw,
  Truck,
  Calendar,
} from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OPERATIONS' | 'CONFIG'>('OPERATIONS');

  // Config Audit State
  const [selectedConfigLog, setSelectedConfigLog] = useState<ConfigurationAuditResponse | null>(null);
  const [configActionFilter, setConfigActionFilter] = useState<string>('ALL');

  // Operational Lifecycle Audit State
  const [selectedOperationalLog, setSelectedOperationalLog] = useState<AuditLogItem | null>(null);
  const [opEntityTypeFilter, setOpEntityTypeFilter] = useState<string>('ALL');
  const [opActionFilter, setOpActionFilter] = useState<string>('ALL');

  // Operational Audit Query
  const {
    data: opData,
    isLoading: isOpLoading,
    error: opError,
    refetch: refetchOp,
  } = useQuery<AuditLogResponse>({
    queryKey: ['adminOperationalAuditLogs'],
    queryFn: () => auditLogsApi.list({ page_size: 150 }),
    refetchInterval: 15000,
  });

  const operationalLogs: AuditLogItem[] = opData?.items ?? [];

  // Config Audit Query
  const {
    data: configLogs = [],
    isLoading: isConfigLoading,
    error: configError,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['adminConfigAudit'],
    queryFn: configurationApi.listAuditLogs,
    enabled: activeTab === 'CONFIG',
  });

  // Operational Filter Options
  const opActions: string[] = Array.from(new Set(operationalLogs.map((l) => l.action)));
  const opEntityTypes: string[] = Array.from(new Set(operationalLogs.map((l) => l.entity_type)));

  const filteredOpLogs = operationalLogs.filter((log) => {
    if (opEntityTypeFilter !== 'ALL' && log.entity_type !== opEntityTypeFilter) return false;
    if (opActionFilter !== 'ALL' && log.action !== opActionFilter) return false;
    return true;
  });

  // Config Filter Options
  const configActions = Array.from(new Set(configLogs.map((l) => l.action)));
  const filteredConfigLogs = configLogs.filter((log) => {
    if (configActionFilter === 'ALL') return true;
    return log.action === configActionFilter;
  });

  // Operational Audit Columns
  const operationalColumns: Column<AuditLogItem>[] = [
    {
      key: 'id',
      header: 'Audit ID',
      sortable: true,
      render: (l) => <span className="font-mono font-bold text-charcoal-900">OP-#{l.id}</span>,
    },
    {
      key: 'action',
      header: 'Lifecycle Action',
      sortable: true,
      render: (l) => {
        const isApprove = l.action.includes('APPROV') || l.action.includes('DISPATCH') || l.action.includes('COLLECT');
        const isReassign = l.action.includes('REASSIGN') || l.action.includes('RERUN');
        const isRelease = l.action.includes('RELEASE') || l.action.includes('CANCEL') || l.action.includes('FAIL');
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
              isApprove
                ? 'bg-emerald-100 text-emerald-800'
                : isReassign
                ? 'bg-blue-100 text-blue-800'
                : isRelease
                ? 'bg-amber-100 text-amber-800'
                : 'bg-ivory-200 text-charcoal-800'
            }`}
          >
            {l.action}
          </span>
        );
      },
    },
    {
      key: 'entity_type',
      header: 'Entity Ref',
      render: (l) => (
        <div className="text-xs">
          <span className="font-semibold text-charcoal-800 uppercase tracking-wider text-[10px]">
            {l.entity_type}
          </span>
          <div className="font-mono font-bold text-charcoal-900">
            {l.entity_code || `#${l.entity_id}`}
          </div>
        </div>
      ),
    },
    {
      key: 'actor_name',
      header: 'Administrator / Actor',
      render: (l) => (
        <span className="font-medium text-xs text-charcoal-900 flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-charcoal-400" />
          <span>{l.actor_name || `User #${l.actor_id}`} ({l.actor_role || 'ADMIN'})</span>
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Details / Summary',
      render: (l) => {
        const detailStr = l.details
          ? typeof l.details === 'object'
            ? l.details.reason || l.details.summary || JSON.stringify(l.details).slice(0, 60)
            : String(l.details)
          : '—';
        return (
          <span className="text-xs text-charcoal-600 truncate max-w-xs block font-mono" title={detailStr}>
            {detailStr}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Timestamp',
      sortable: true,
      render: (l) => <span className="text-xs text-charcoal-700">{formatDateTime(l.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (l) => (
        <button
          onClick={() => setSelectedOperationalLog(l)}
          className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
          title="Inspect Operational Record"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  // Config Audit Columns
  const configColumns: Column<ConfigurationAuditResponse>[] = [
    {
      key: 'id',
      header: 'Audit ID',
      sortable: true,
      render: (l) => <span className="font-mono font-bold text-charcoal-900">CFG-#{l.id}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (l) => {
        const isCreate = l.action.includes('CREATE') || l.action.includes('ACTIVAT');
        const isRollback = l.action.includes('ROLLBACK') || l.action.includes('REJECT');
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
              isCreate
                ? 'bg-emerald-100 text-emerald-800'
                : isRollback
                ? 'bg-amber-100 text-amber-800'
                : 'bg-ivory-200 text-charcoal-800'
            }`}
          >
            {l.action}
          </span>
        );
      },
    },
    {
      key: 'actor_id',
      header: 'Actor ID',
      sortable: true,
      render: (l) => (
        <span className="font-medium text-xs text-charcoal-900 flex items-center gap-1.5 font-mono">
          <UserCheck className="w-3.5 h-3.5 text-charcoal-400" />
          <span>User #{l.actor_id}</span>
        </span>
      ),
    },
    {
      key: 'configuration_id',
      header: 'Entity Ref',
      render: (l) => (
        <div className="text-xs text-charcoal-600 font-mono">
          Config #{l.configuration_id}
          {l.configuration_version_id ? ` · Ver #${l.configuration_version_id}` : ''}
          {l.change_request_id ? ` · Chg #${l.change_request_id}` : ''}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason / Justification',
      render: (l) => (
        <span className="text-xs text-charcoal-600 truncate max-w-xs block">
          {l.reason || '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Timestamp',
      sortable: true,
      render: (l) => <span className="text-xs text-charcoal-700">{formatDateTime(l.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (l) => (
        <button
          onClick={() => setSelectedConfigLog(l)}
          className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
          title="Inspect Config Record"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-charcoal-900 tracking-tight">
              Control Tower Audit Logs
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-ivory-200 text-charcoal-800">
              <Shield className="w-3 h-3 text-charcoal-600" /> Tamper-evident Audit Trail
            </span>
          </div>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Immutable log of pickup lifecycles, route optimizations, approvals, fleet assignments, dispatches, and configuration modifications.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-ivory-300 pb-1">
        <button
          onClick={() => setActiveTab('OPERATIONS')}
          className={`pb-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'OPERATIONS'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-600" />
          <span>Operational Lifecycle Trail ({operationalLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('CONFIG')}
          className={`pb-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'CONFIG'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <FileText className="w-4 h-4 text-charcoal-600" />
          <span>System & Rule Configuration ({configLogs.length})</span>
        </button>
      </div>

      {activeTab === 'OPERATIONS' ? (
        <div className="space-y-4">
          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-xs font-semibold text-charcoal-700">Entity:</span>
              <select
                value={opEntityTypeFilter}
                onChange={(e) => setOpEntityTypeFilter(e.target.value)}
                className="px-2.5 py-1 text-xs bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="ALL">All Entities</option>
                {opEntityTypes.map((et) => (
                  <option key={et} value={et}>{et}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-charcoal-700">Action:</span>
              <select
                value={opActionFilter}
                onChange={(e) => setOpActionFilter(e.target.value)}
                className="px-2.5 py-1 text-xs bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="ALL">All Actions</option>
                {opActions.map((act) => (
                  <option key={act} value={act}>{act}</option>
                ))}
              </select>
            </div>

            {(opEntityTypeFilter !== 'ALL' || opActionFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setOpEntityTypeFilter('ALL');
                  setOpActionFilter('ALL');
                }}
                className="text-xs font-semibold text-charcoal-600 hover:text-charcoal-900 underline ml-2"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Operational Audit Table */}
          {opError ? (
            <ErrorState
              title="Unable to load operational audit logs"
              message={opError instanceof Error ? opError.message : 'An unexpected error occurred.'}
              onRetry={() => { void refetchOp(); }}
            />
          ) : (
            <DataTable
              columns={operationalColumns}
              data={filteredOpLogs}
              isLoading={isOpLoading}
              searchPlaceholder="Search by action, entity code, actor, or details..."
              searchFilter={(row, q) =>
                row.action.toLowerCase().includes(q) ||
                row.entity_type.toLowerCase().includes(q) ||
                Boolean(row.entity_code && row.entity_code.toLowerCase().includes(q)) ||
                Boolean(row.actor_name && row.actor_name.toLowerCase().includes(q))
              }
              onRowClick={(row) => setSelectedOperationalLog(row)}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Config Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setConfigActionFilter('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                configActionFilter === 'ALL'
                  ? 'bg-charcoal-900 text-white border-charcoal-900'
                  : 'bg-white text-charcoal-600 border-ivory-300 hover:bg-ivory-100'
              }`}
            >
              All Actions ({configLogs.length})
            </button>
            {configActions.map((act) => (
              <button
                key={act}
                onClick={() => setConfigActionFilter(act)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                  configActionFilter === act
                    ? 'bg-charcoal-900 text-white border-charcoal-900'
                    : 'bg-white text-charcoal-600 border-ivory-300 hover:bg-ivory-100'
                }`}
              >
                {act}
              </button>
            ))}
          </div>

          {/* Config Audit Table */}
          {configError ? (
            <ErrorState
              title="Unable to load configuration audit logs"
              message={configError instanceof Error ? configError.message : 'An unexpected error occurred.'}
              onRetry={() => { void refetchConfig(); }}
            />
          ) : (
            <DataTable
              columns={configColumns}
              data={filteredConfigLogs}
              isLoading={isConfigLoading}
              searchPlaceholder="Search by action, actor, or reason..."
              searchFilter={(row, q) =>
                row.action.toLowerCase().includes(q) ||
                String(row.actor_id).includes(q) ||
                Boolean(row.reason && row.reason.toLowerCase().includes(q))
              }
              onRowClick={(row) => setSelectedConfigLog(row)}
            />
          )}
        </div>
      )}

      {/* Operational Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedOperationalLog}
        onClose={() => setSelectedOperationalLog(null)}
        title={selectedOperationalLog ? `Operational Audit OP-#${selectedOperationalLog.id}` : ''}
        subtitle={selectedOperationalLog ? `${selectedOperationalLog.action} on ${selectedOperationalLog.entity_type} ${selectedOperationalLog.entity_code || ''}` : ''}
        width="xl"
      >
        {selectedOperationalLog && (
          <div className="space-y-6 text-xs">
            <div className="p-4 bg-ivory-100 rounded-xl border border-ivory-300 grid grid-cols-2 gap-3">
              <div>
                <span className="text-charcoal-500 font-medium">Actor</span>
                <div className="font-bold text-charcoal-900 mt-0.5">
                  {selectedOperationalLog.actor_name || `User #${selectedOperationalLog.actor_id}`}
                </div>
                <div className="text-[11px] text-charcoal-500 font-mono">
                  Role: {selectedOperationalLog.actor_role || 'ADMIN'} · ID #{selectedOperationalLog.actor_id}
                </div>
              </div>
              <div>
                <span className="text-charcoal-500 font-medium">Timestamp</span>
                <div className="font-semibold text-charcoal-900 mt-0.5">{formatDateTime(selectedOperationalLog.created_at)}</div>
              </div>
              <div>
                <span className="text-charcoal-500 font-medium">Target Entity</span>
                <div className="font-mono font-bold text-charcoal-900 mt-0.5">
                  {selectedOperationalLog.entity_type} · {selectedOperationalLog.entity_code || `#${selectedOperationalLog.entity_id}`}
                </div>
              </div>
              <div>
                <span className="text-charcoal-500 font-medium">Network Context</span>
                <div className="font-mono text-charcoal-900 mt-0.5 text-[11px]">
                  IP: {selectedOperationalLog.ip_address || 'Internal/Local'}
                </div>
              </div>
            </div>

            {/* Structured Details JSON */}
            <div className="space-y-2">
              <span className="font-bold text-charcoal-800 uppercase tracking-wider text-[11px]">
                Audit Record Payload Details
              </span>
              <pre className="p-4 bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-lg overflow-x-auto max-h-96 border border-slate-800">
                {JSON.stringify(selectedOperationalLog.details, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Config Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedConfigLog}
        onClose={() => setSelectedConfigLog(null)}
        title={selectedConfigLog ? `Config Audit CFG-#${selectedConfigLog.id}` : ''}
        subtitle={selectedConfigLog ? `Action: ${selectedConfigLog.action} by User #${selectedConfigLog.actor_id}` : ''}
        width="xl"
      >
        {selectedConfigLog && (
          <div className="space-y-6 text-xs">
            <div className="p-4 bg-ivory-100 rounded-xl border border-ivory-300 grid grid-cols-2 gap-3">
              <div>
                <span className="text-charcoal-500 font-medium">Actor ID</span>
                <div className="font-bold text-charcoal-900 mt-0.5 font-mono">User #{selectedConfigLog.actor_id}</div>
              </div>
              <div>
                <span className="text-charcoal-500 font-medium">Timestamp</span>
                <div className="font-semibold text-charcoal-900 mt-0.5">{formatDateTime(selectedConfigLog.created_at)}</div>
              </div>
              <div>
                <span className="text-charcoal-500 font-medium">Target Configuration ID</span>
                <div className="font-mono text-charcoal-900 mt-0.5">#{selectedConfigLog.configuration_id}</div>
              </div>
              <div>
                <span className="text-charcoal-500 font-medium">Associated Version / Change</span>
                <div className="font-mono text-charcoal-900 mt-0.5">
                  Ver: {selectedConfigLog.configuration_version_id ?? 'None'} · Chg: {selectedConfigLog.change_request_id ?? 'None'}
                </div>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-ivory-300 space-y-2">
              <div>
                <span className="font-bold text-charcoal-800 uppercase tracking-wider text-[10px]">
                  Reason / Change Justification
                </span>
                <p className="text-charcoal-700 mt-1 leading-relaxed">
                  {selectedConfigLog.reason || 'No justification provided.'}
                </p>
              </div>
              {selectedConfigLog.change_reference && (
                <div className="pt-2 border-t border-ivory-200">
                  <span className="font-bold text-charcoal-800 uppercase tracking-wider text-[10px]">
                    External Ticket / Compliance Reference
                  </span>
                  <div className="font-mono text-charcoal-900 mt-1">{selectedConfigLog.change_reference}</div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-charcoal-900 uppercase tracking-wider text-[11px]">
                Payload State Transition (Before vs After)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">
                    Previous Value (old_value)
                  </span>
                  <pre className="p-3 bg-slate-900 text-rose-300 font-mono text-[11px] rounded-lg overflow-x-auto max-h-60 border border-slate-800">
                    {selectedConfigLog.old_value !== null && selectedConfigLog.old_value !== undefined
                      ? JSON.stringify(selectedConfigLog.old_value, null, 2)
                      : 'null'}
                  </pre>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
                    Updated Value (new_value)
                  </span>
                  <pre className="p-3 bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-lg overflow-x-auto max-h-60 border border-slate-800">
                    {selectedConfigLog.new_value !== null && selectedConfigLog.new_value !== undefined
                      ? JSON.stringify(selectedConfigLog.new_value, null, 2)
                      : 'null'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};

export default AuditLogs;
