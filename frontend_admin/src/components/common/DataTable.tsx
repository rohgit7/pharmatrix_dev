import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  filterSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  isLoading = false,
  searchPlaceholder = 'Search records...',
  searchFilter,
  filterSlot,
  actionSlot,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display matching the current criteria.',
  pageSize = 10,
  onRowClick,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    if (searchFilter) {
      return data.filter((row) => searchFilter(row, searchQuery.toLowerCase()));
    }
    return data.filter((row) =>
      JSON.stringify(row).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery, searchFilter]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (
        typeof aVal === 'string' &&
        typeof bVal === 'string' &&
        aVal.trim() !== '' &&
        bVal.trim() !== '' &&
        Number.isFinite(Number(aVal)) &&
        Number.isFinite(Number(bVal))
      ) {
        const comparison = Number(aVal) - Number(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-ivory-300 shadow-subtle overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-ivory-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-charcoal-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-ivory-50 border border-ivory-300 rounded-lg placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-periwinkle-400 focus:border-periwinkle text-charcoal"
            />
          </div>
          {filterSlot}
        </div>
        {actionSlot && <div className="flex items-center gap-2">{actionSlot}</div>}
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-charcoal">
          <thead className="bg-ivory-100/70 border-b border-ivory-200 text-xs font-semibold text-charcoal-600 uppercase tracking-wider">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-3 px-4 ${col.className || ''} ${
                    col.sortable ? 'cursor-pointer hover:bg-ivory-200/50 select-none' : ''
                  }`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && <ChevronsUpDown className="w-3.5 h-3.5 text-charcoal-400" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ivory-200">
            {isLoading ? (
              <LoadingSkeleton type="table-row" count={pageSize > 5 ? 5 : pageSize} />
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={row.id ? String(row.id) : index}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-ivory-50/70 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`py-3.5 px-4 ${col.className || ''}`}>
                      {col.render ? col.render(row) : (row as any)[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && sortedData.length > 0 && (
        <div className="p-3.5 border-t border-ivory-200 bg-ivory-50/50 flex items-center justify-between text-xs text-charcoal-600">
          <div>
            Showing <span className="font-medium text-charcoal-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-medium text-charcoal-900">
              {Math.min(currentPage * pageSize, sortedData.length)}
            </span>{' '}
            of <span className="font-medium text-charcoal-900">{sortedData.length}</span> records
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-ivory-300 bg-white hover:bg-ivory-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-ivory-300 bg-white hover:bg-ivory-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
