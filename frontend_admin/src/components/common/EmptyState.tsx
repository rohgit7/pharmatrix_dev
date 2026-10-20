import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-ivory-300 shadow-subtle ${className}`}>
      <div className="w-12 h-12 mb-4 rounded-xl bg-ivory-100 border border-ivory-300 flex items-center justify-center text-charcoal-500">
        <Icon className="w-6 h-6 text-charcoal-600" />
      </div>
      <h3 className="text-base font-semibold text-charcoal-900">{title}</h3>
      <p className="mt-1 text-sm text-charcoal-500 max-w-sm">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
