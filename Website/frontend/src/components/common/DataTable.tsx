import React from 'react';
import { Card } from '../Card';
import { Loader2, AlertCircle } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  loading = false,
  error = null,
  emptyTitle = 'No records available',
  emptyDescription = 'There is currently no data matching your query.',
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <Card className="p-16 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="animate-spin text-primary-600 dark:text-primary-400 mb-3" size={32} />
        <p className="text-sm font-medium">Loading evaluation dataset...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-center flex flex-col items-center">
        <AlertCircle className="text-red-600 dark:text-red-400 mb-2" size={28} />
        <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Data Fetch Error</h4>
        <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-md">{error}</p>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Card className={`p-0 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`p-4 ${
                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                  } ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {data.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition-colors ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`p-4 ${
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    } ${col.className || ''}`}
                  >
                    {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
