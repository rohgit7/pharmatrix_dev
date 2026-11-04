const WASTE_CATEGORY_NAMES: Record<string, string> = {
  EXPIRED_DISCARDED_MEDICINE: 'Expired & Discarded Medicines',
  CHEMICAL: 'Chemical & Cytotoxic Waste',
  CHEMICAL_LIQUID: 'Liquid Chemical Waste',
  GLASSWARE: 'Contaminated Glassware & Vials',
  CONTAMINATED_RECYCLABLE: 'Contaminated Recyclables',
  SHARPS: 'Clinical & Pharma Sharps',
  HAZARDOUS_OTHER: 'Other Hazardous Waste',
};

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Requested',
  SCHEDULED: 'Scheduled',
  ASSIGNED: 'Driver Assigned',
  IN_PROGRESS: 'In Progress',
  ARRIVED: 'Driver Arrived',
  COLLECTED: 'Completed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
  PAID: 'Paid',
  PENDING: 'Payment Due',
  ISSUED: 'Bill Issued',
  PARTIALLY_PAID: 'Partially Paid',
  AWAITING_WEIGHING: 'Awaiting Weigh-In',
  VERIFIED: 'Verified',
  ACTIVE: 'Active',
  OVERDUE: 'Overdue',
  NORMAL: 'Standard',
  HIGH: 'High Priority',
  URGENT: 'Urgent',
};

export function formatStatusLabel(status?: string | null): string {
  if (!status) return 'Pending';
  const upper = status.toUpperCase().trim();
  if (STATUS_LABELS[upper]) {
    return STATUS_LABELS[upper];
  }
  return upper
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatWasteCategory(code?: string | null): string {
  if (!code) return 'Pharmaceutical Waste';
  const upper = code.toUpperCase().trim();
  if (WASTE_CATEGORY_NAMES[upper]) {
    return WASTE_CATEGORY_NAMES[upper];
  }
  return upper
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return 'Not scheduled';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return 'Not recorded';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatCurrency(
  amount?: number | null,
  currency: string = 'INR'
): string {
  if (amount == null || isNaN(amount)) return '—';
  const symbol = currency.toUpperCase() === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

