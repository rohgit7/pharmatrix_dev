import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { whatsappApi } from '../api/operations';
import {
  WhatsAppTemplateResponse,
  WhatsAppTemplateCreate,
  WhatsAppTemplateUpdate,
  NotificationType,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
import { formatDate, formatDateTime } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import {
  MessageSquare,
  Plus,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Trash2,
  Languages,
  Layers,
  Send,
  HelpCircle,
} from 'lucide-react';

const NOTIFICATION_TYPES: NotificationType[] = [
  'PICKUP_REQUESTED',
  'PICKUP_SCHEDULED',
  'PICKUP_REMINDER',
  'DRIVER_ASSIGNED',
  'PICKUP_COMPLETED',
  'SHIPMENT_DISPATCHED',
  'SHIPMENT_RECEIVED',
  'DISPOSAL_COMPLETED',
  'EXCEPTION_ESCALATED',
];

export const WhatsAppTemplates: React.FC = () => {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplateResponse | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<WhatsAppTemplateResponse | null>(null);

  // Form State
  const [notificationType, setNotificationType] = useState<NotificationType>(NOTIFICATION_TYPES[0]);
  const [templateKey, setTemplateKey] = useState('');
  const [metaTemplateName, setMetaTemplateName] = useState('');
  const [languageCode, setLanguageCode] = useState('en_US');
  const [parameterKeysInput, setParameterKeysInput] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const {
    data: templates = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['adminWhatsAppTemplates'],
    queryFn: () => whatsappApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: WhatsAppTemplateCreate) => whatsappApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminWhatsAppTemplates'] });
      setAlert({
        type: 'success',
        message: `Template "${data.meta_template_name}" registered successfully.`,
      });
      closeModal();
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: WhatsAppTemplateUpdate }) =>
      whatsappApi.update(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminWhatsAppTemplates'] });
      setAlert({
        type: 'success',
        message: `Template "${data.meta_template_name}" updated successfully.`,
      });
      closeModal();
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => whatsappApi.activate(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminWhatsAppTemplates'] });
      setAlert({
        type: 'success',
        message: `Template "${data.meta_template_name}" activated.`,
      });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => whatsappApi.deactivate(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminWhatsAppTemplates'] });
      setAlert({
        type: 'success',
        message: `Template "${data.meta_template_name}" deactivated.`,
      });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => whatsappApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminWhatsAppTemplates'] });
      setAlert({
        type: 'success',
        message: 'WhatsApp template deleted successfully.',
      });
      setTemplateToDelete(null);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const openCreateModal = () => {
    setEditingTemplate(null);
    setNotificationType(NOTIFICATION_TYPES[0]);
    setTemplateKey('');
    setMetaTemplateName('');
    setLanguageCode('en_US');
    setParameterKeysInput('customer_name, pickup_code, scheduled_date');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (tpl: WhatsAppTemplateResponse) => {
    setEditingTemplate(tpl);
    setNotificationType(tpl.notification_type);
    setTemplateKey(tpl.template_key);
    setMetaTemplateName(tpl.meta_template_name);
    setLanguageCode(tpl.language_code);
    setParameterKeysInput((tpl.parameter_keys || []).join(', '));
    setIsActive(tpl.is_active);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedParams = parameterKeysInput
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        payload: {
          template_key: templateKey,
          meta_template_name: metaTemplateName,
          language_code: languageCode,
          parameter_keys: parsedParams,
          is_active: isActive,
        },
      });
    } else {
      createMutation.mutate({
        notification_type: notificationType,
        template_key: templateKey,
        meta_template_name: metaTemplateName,
        language_code: languageCode,
        parameter_keys: parsedParams,
        is_active: isActive,
      });
    }
  };

  // KPIs
  const totalCount = templates.length;
  const activeCount = templates.filter((t) => t.is_active).length;
  const uniqueLanguages = new Set(templates.map((t) => t.language_code)).size;

  const columns: Column<WhatsAppTemplateResponse>[] = [
    {
      key: 'notification_type',
      header: 'Event Trigger',
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-slate-800 block">
            {row.notification_type.replace(/_/g, ' ')}
          </span>
          <span className="font-mono text-[11px] text-slate-500">{row.template_key}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'meta_template_name',
      header: 'Meta Template Name',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          {row.meta_template_name}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'language_code',
      header: 'Language',
      render: (row) => (
        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {row.language_code}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'parameter_keys',
      header: 'Dynamic Variables',
      render: (row) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {row.parameter_keys && row.parameter_keys.length > 0 ? (
            row.parameter_keys.map((k: string, idx: number) => (
              <span
                key={idx}
                className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
              >
                &#123;&#123;{k}&#125;&#125;
              </span>
            ))
          ) : (
            <span className="text-[11px] text-slate-400 italic">None</span>
          )}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
            row.is_active
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.is_active ? (
            <button
              onClick={() => deactivateMutation.mutate(row.id)}
              disabled={deactivateMutation.isPending}
              className="p-1 text-emerald-600 hover:text-emerald-700"
              title="Deactivate Template"
            >
              <ToggleRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => activateMutation.mutate(row.id)}
              disabled={activateMutation.isPending}
              className="p-1 text-slate-400 hover:text-slate-600"
              title="Activate Template"
            >
              <ToggleLeft className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => openEditModal(row)}
            className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100"
            title="Edit Template"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setTemplateToDelete(row)}
            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
            title="Delete Template"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              WhatsApp Notification Templates
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure Meta WhatsApp Business messaging templates for pickup scheduling, driver arrival alerts, scale receipts, and manifests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Register Meta Template</span>
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {alert && (
        <div
          className={`px-4 py-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{alert.message}</span>
          </div>
          <button onClick={() => setAlert(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* 2. KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Configured Templates</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">{totalCount}</span>
            <Layers className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Active in Production</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-emerald-600">{activeCount}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Supported Locales</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-blue-600">{uniqueLanguages}</span>
            <Languages className="w-5 h-5 text-blue-500" />
          </div>
        </div>
      </div>

      {/* 3. DataTable */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={templates}
          isLoading={isLoading}
          emptyTitle="No WhatsApp notification templates found"
          emptyDescription="No WhatsApp notification templates configured."
        />
      </div>

      {/* 4. Modal (Create / Edit) */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title={editingTemplate ? `Edit Template — ${editingTemplate.meta_template_name}` : 'Register New Meta Template'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Event Notification Trigger *
              </label>
              <select
                value={notificationType}
                onChange={(e) => setNotificationType(e.target.value as NotificationType)}
                disabled={Boolean(editingTemplate)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
              >
                {NOTIFICATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Internal Template Key *
                </label>
                <input
                  type="text"
                  required
                  value={templateKey}
                  onChange={(e) => setTemplateKey(e.target.value)}
                  placeholder="e.g. pickup_confirmed_v1"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Meta Template Name *
                </label>
                <input
                  type="text"
                  required
                  value={metaTemplateName}
                  onChange={(e) => setMetaTemplateName(e.target.value)}
                  placeholder="pharmatrix_pickup_alert"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Language Locale *
                </label>
                <input
                  type="text"
                  required
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                  placeholder="en_US, hi_IN, kn_IN..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Active in Dispatch
                </label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is_active_toggle"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="is_active_toggle" className="text-xs text-slate-700 font-medium">
                    Enable immediate delivery
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dynamic Variables (Comma-separated)
              </label>
              <input
                type="text"
                value={parameterKeysInput}
                onChange={(e) => setParameterKeysInput(e.target.value)}
                placeholder="customer_name, pickup_code, date, weight_kg"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Variables mapped in order: &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125;, &#123;&#123;3&#125;&#125; in the Meta WhatsApp template body.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving…'
                  : editingTemplate
                  ? 'Update Template'
                  : 'Register Template'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!templateToDelete}
        onClose={() => setTemplateToDelete(null)}
        title="Delete WhatsApp Template"
        subtitle={`Confirm permanent removal of template "${templateToDelete?.meta_template_name}"`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-700">
            Are you sure you want to delete template <strong className="font-mono text-slate-900">{templateToDelete?.meta_template_name}</strong> ({templateToDelete?.template_key})?
            Automated WhatsApp notifications for event <strong className="text-slate-900">{templateToDelete?.notification_type}</strong> using this template will cease immediately.
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
            <strong>Warning:</strong> Ensure an alternative template is active if customer messaging is required for this lifecycle event.
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setTemplateToDelete(null)}
              className="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (templateToDelete) {
                  deleteMutation.mutate(templateToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Template'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WhatsAppTemplates;
