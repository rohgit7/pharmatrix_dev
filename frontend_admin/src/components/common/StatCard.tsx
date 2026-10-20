import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'warning' | 'neutral';
  badge?: string;
  badgeType?: 'default' | 'success' | 'warning';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  badge,
  badgeType = 'default',
}) => {
  let iconBg = 'bg-ivory-100 text-charcoal-700 border-ivory-300';
  if (variant === 'primary') {
    iconBg = 'bg-periwinkle-100 text-periwinkle-800 border-periwinkle-200';
  } else if (variant === 'warning') {
    iconBg = 'bg-amber-100 text-amber-800 border-amber-200';
  }

  let badgeColor = 'bg-charcoal-100 text-charcoal-700';
  if (badgeType === 'success') {
    badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (badgeType === 'warning') {
    badgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
  }

  return (
    <div className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle hover:shadow-card transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">{title}</span>
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-charcoal-900 tracking-tight">{value}</span>
        {badge && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-charcoal-500">{subtitle}</p>}
    </div>
  );
};
