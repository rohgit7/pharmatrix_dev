import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { whatsappApi } from '../api/operations';
import { NotificationType, WhatsAppTemplateResponse } from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { formatDate } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { MessageSquare, Plus, CheckCircle2, AlertCircle } from 'lucide-react';

export const WhatsAppTemplates: React.FC = () => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [createForm, setCreateForm] = useState<{
    notification_type: NotificationType | '';
    template_key: string;
    meta_template_name: string;
    language_code: string;
    parameter_keys: string;
    is_active: boolean;
  }>({
    notification_type: '',
    template_key: '',
    meta_template_name: '',
    language_code: 'en_US',
    parameter_keys: '',
    is_active: true,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['adminWhatsAppTemplates'],
    queryFn: whatsappApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (form: Omit<typeof createForm, 'notification_type'> & { notification_type: NotificationType }) =>
      whatsappApi.create({
        notification_type: form.notification_type,
        template_key: form.template_key.trim(),
        meta_template_name: form.meta_template_name.trim(),
        language_code: form.language_code.trim(),
        parameter_keys: form.parameter_keys.split(',').map((k) => k.trim()).filter(Boolean),
        is_active: form.is_active,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminWhatsAppTemplates'] });
      setAlert({
        type: 'success',
        message: `WhatsApp template "${data.template_key}" registered successfully.`,
      });
      setShowCreateModal(false);
      setCreateForm({
        notification_type: '',
        template_key: '',
        meta_template_name: '',
        language_code: 'en_US',
        parameter_keys: '',
        is_active: true,
      });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const activateMutation = useMutation({
    mutationFn: whatsappApi.activate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminWhatsAppTemplates'] });
      setAlert({ type: 'success', message: 'Template activated for outbound messaging.' });
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const deactivateMutation = useMutation({
    mutationFn: whatsappApi.deactivate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminWhatsAppTemplates'] });
      setAlert({ type: 'success', message: 'Template deactivated.' });
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const columns: Column<WhatsAppTemplateResponse>[] = [
    {
      key: 'template_key',
      header: 'Template Key',
      sortable: true,
      render: (t) => <span className="font-mono font-bold text-charcoal-900">{t.template_key}</span>,
    },
    {
      key: 'notification_type',
      header: 'Trigger Event',
      sortable: true,
      render: (t) => <span className="font-semibold text-xs text-charcoal-800">{t.notification_type}</span>,
    },
    {
      key: 'meta_template_name',
      header: 'Meta Cloud Name',
      render: (t) => <span className="font-mono text-xs text-charcoal-600">{t.meta_template_name}</span>,
    },
    {
      key: 'language_code',
      header: 'Lang',
      render: (t) => <span className="uppercase text-xs font-semibold">{t.language_code}</span>,
    },
    {
      key: 'parameter_keys',
      header: 'Parameters',
      render: (t) => <span className="text-xs">{t.parameter_keys.join(', ') || '—'}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      render: (t) => <StatusBadge status={t.is_active ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (t) => <span>{formatDate(t.created_at)}</span>,
    },
    {
      key: 'updated_at',
      header: 'Updated',
      render: (t) => <span>{formatDate(t.updated_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (t) => (
        <div className="flex items-center justify-end gap-2">
          {t.is_active ? (
            <button
              onClick={() => deactivateMutation.mutate(t.id)}
              disabled={deactivateMutation.isPending}
              className="px-2 py-1 text-xs font-semibold rounded-lg bg-rose-100 text-rose-800 hover:bg-rose-200 transition-colors"
            >
              Deactivate
            </button>
          ) : (
            <button
              onClick={() => activateMutation.mutate(t.id)}
              disabled={activateMutation.isPending}
              className="px-2 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
            >
              Activate
            </button>
          )}
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
          <h2 className="text-xl font-bold text-charcoal-900 tracking-tight">WhatsApp Messaging Templates</h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Configure approved Meta Cloud Business API templates for automated customer notifications.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Template</span>
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={templates}
        isLoading={isLoading}
        searchPlaceholder="Filter templates..."
        searchFilter={(row, q) =>
          row.template_key.toLowerCase().includes(q) ||
          row.notification_type.toLowerCase().includes(q) ||
          row.meta_template_name.toLowerCase().includes(q)
        }
      />

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Register WhatsApp Template"
        subtitle="Map system operational events to Meta approved message templates"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const notificationType = createForm.notification_type;
            if (!notificationType) return;
            createMutation.mutate({ ...createForm, notification_type: notificationType });
          }}
          className="space-y-3.5 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Trigger Event
            </label>
            <select
              value={createForm.notification_type}
              onChange={(e) =>
                setCreateForm({ ...createForm, notification_type: e.target.value as NotificationType })
              }
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="">Select notification event...</option>
              <option value="PICKUP_REQUESTED">PICKUP_REQUESTED</option>
              <option value="PICKUP_SCHEDULED">PICKUP_SCHEDULED</option>
              <option value="PICKUP_REMINDER">PICKUP_REMINDER</option>
              <option value="DRIVER_ASSIGNED">DRIVER_ASSIGNED</option>
              <option value="PICKUP_COMPLETED">PICKUP_COMPLETED</option>
              <option value="SHIPMENT_DISPATCHED">SHIPMENT_DISPATCHED</option>
              <option value="SHIPMENT_RECEIVED">SHIPMENT_RECEIVED</option>
              <option value="DISPOSAL_COMPLETED">DISPOSAL_COMPLETED</option>
              <option value="EXCEPTION_ESCALATED">EXCEPTION_ESCALATED</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Template Key
              </label>
              <input
                required
                type="text"
                maxLength={100}
                placeholder="pickup_scheduled_v1"
                value={createForm.template_key}
                onChange={(e) => setCreateForm({ ...createForm, template_key: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Meta Template Name
              </label>
              <input
                required
                type="text"
                maxLength={100}
                placeholder="pharmatrix_pickup_scheduled"
                value={createForm.meta_template_name}
                onChange={(e) => setCreateForm({ ...createForm, meta_template_name: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Language Code
              </label>
              <input
                required
                type="text"
                minLength={2}
                maxLength={20}
                placeholder="en"
                value={createForm.language_code}
                onChange={(e) => setCreateForm({ ...createForm, language_code: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Active Immediately
              </label>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createForm.is_active}
                  onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
                  className="rounded border-ivory-300 text-periwinkle focus:ring-periwinkle"
                />
                <span className="text-charcoal-800">Enable outbound sends</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Variable Parameter Keys (Comma-separated)
            </label>
            <input
              type="text"
              placeholder="pickup_code, scheduled_date, driver_name"
              value={createForm.parameter_keys}
              onChange={(e) => setCreateForm({ ...createForm, parameter_keys: e.target.value })}
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
              disabled={createMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Registering...' : 'Register Template'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
