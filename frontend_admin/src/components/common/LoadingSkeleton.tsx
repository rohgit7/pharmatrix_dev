import React from 'react';

interface LoadingSkeletonProps {
  type?: 'card' | 'table-row' | 'stat-card' | 'text';
  count?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  type = 'table-row',
  count = 3,
  className = '',
}) => {
  const items = Array.from({ length: count });

  if (type === 'stat-card') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-charcoal-100 rounded w-24"></div>
              <div className="h-9 w-9 bg-charcoal-100 rounded-lg"></div>
            </div>
            <div className="mt-4 h-8 bg-charcoal-100 rounded w-16"></div>
            <div className="mt-2 h-3 bg-charcoal-100 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`space-y-4 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle animate-pulse space-y-3">
            <div className="h-5 bg-charcoal-100 rounded w-1/3"></div>
            <div className="h-4 bg-charcoal-100 rounded w-2/3"></div>
            <div className="h-4 bg-charcoal-100 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table-row') {
    return (
      <>
        {items.map((_, i) => (
          <tr key={i} className="animate-pulse border-b border-ivory-200">
            <td className="py-4 px-4"><div className="h-4 bg-charcoal-100 rounded w-20"></div></td>
            <td className="py-4 px-4"><div className="h-4 bg-charcoal-100 rounded w-32"></div></td>
            <td className="py-4 px-4"><div className="h-4 bg-charcoal-100 rounded w-24"></div></td>
            <td className="py-4 px-4"><div className="h-4 bg-charcoal-100 rounded w-28"></div></td>
            <td className="py-4 px-4"><div className="h-4 bg-charcoal-100 rounded w-16"></div></td>
            <td className="py-4 px-4 text-right"><div className="h-4 bg-charcoal-100 rounded w-12 ml-auto"></div></td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <div className={`space-y-2 animate-pulse ${className}`}>
      {items.map((_, i) => (
        <div key={i} className="h-4 bg-charcoal-100 rounded w-full"></div>
      ))}
    </div>
  );
};
