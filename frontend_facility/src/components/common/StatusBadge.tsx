import React from 'react';
import { formatEnumLabel } from '../../utils/formatters';

interface StatusBadgeProps {
  status: string | boolean | null | undefined;
  size?: 'sm' | 'md';
  customLabel?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm', customLabel }) => {
  if (status === null || status === undefined) {
    return <span className="text-xs text-charcoal-400 font-medium">—</span>;
  }

  const rawStatus =
    typeof status === 'boolean' ? (status ? 'VERIFIED' : 'UNVERIFIED') : status.toUpperCase();
  const label =
    customLabel ||
    (typeof status === 'boolean'
      ? status
        ? 'Verified'
        : 'Unverified'
      : formatEnumLabel(rawStatus));

  let styleClasses = 'bg-charcoal-100 text-charcoal-700 border-charcoal-200';

  if (
    [
      'COLLECTED',
      'COMPLETED',
      'RECEIVED',
      'RESOLVED',
      'ACTIVE',
      'VERIFIED',
      'READY',
      'APPROVED',
      'DISPOSED',
      'CERTIFIED',
      'UPLOADED',
    ].includes(rawStatus)
  ) {
    styleClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (
    ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'IN_TRANSIT', 'PROCESSING', 'OPTIMIZING'].includes(
      rawStatus
    )
  ) {
    styleClasses = 'bg-periwinkle-50 text-periwinkle-800 border-periwinkle-200';
  } else if (
    [
      'REQUESTED',
      'OPEN',
      'ESCALATED',
      'DISCREPANCY',
      'PENDING',
      'PENDING_UPLOAD',
      'AWAITING_DISPOSAL',
      'HIGH',
      'URGENT',
      'UNVERIFIED',
    ].includes(rawStatus)
  ) {
    styleClasses = 'bg-amber-50 text-amber-800 border-amber-300';
  } else if (
    ['FAILED', 'CANCELLED', 'REJECTED', 'SUSPENDED', 'CRITICAL', 'INACTIVE'].includes(rawStatus)
  ) {
    styleClasses = 'bg-rose-50 text-rose-800 border-rose-200';
  } else if (['CREATED', 'DRAFT', 'NORMAL', 'LOW', 'MEDIUM'].includes(rawStatus)) {
    styleClasses = 'bg-ivory-200 text-charcoal-700 border-ivory-300';
  }

  const sizeClasses =
    size === 'sm' ? 'px-2.5 py-0.5 text-xs font-medium' : 'px-3 py-1 text-sm font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClasses} ${styleClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75" />
      {label}
    </span>
  );
};

