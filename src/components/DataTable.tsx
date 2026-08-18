'use client';

import { useState, useMemo } from 'react';
import { CertificateEntry } from '@/types';
import { getExpirationStatus as getExpirationStatusUtil, extractBaseCategory } from '@/lib/expiration';

interface DataTableProps {
  entries: CertificateEntry[];
}

type SortField = 'name' | 'category' | 'expirationDate' | 'email' | 'position' | 'year';
type SortOrder = 'asc' | 'desc';

export default function DataTable({ entries }: DataTableProps) {
  const [filterExpired, setFilterExpired] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('expirationDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data loaded. Upload an Excel file to see the entries.
      </div>
    );
  }

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysUntil = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const extractYearFromCategory = (category: string): number | undefined => {
    const match = category.match(/(\d{4})/);
    return match ? parseInt(match[1]) : undefined;
  };

  const getExpirationStatus = (entry: CertificateEntry) => {
    const backendStatus = getExpirationStatusUtil(entry);
    const daysUntil = getDaysUntil(entry.expirationDate);

    if (backendStatus.expired) {
      return {
        status: 'expired',
        badge: <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Expired</span>,
        reason: `${Math.abs(daysUntil)} days overdue`,
        daysUntil,
      };
    }

    if (daysUntil === 0) {
      return {
        status: 'expiring-today',
        badge: <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Expires Today</span>,
        daysUntil,
      };
    }

    if (daysUntil <= 30) {
      return {
        status: 'expiring-soon',
        badge: <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Expiring Soon</span>,
        daysUntil,
      };
    }

    return {
      status: 'valid',
      badge: <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Valid</span>,
      daysUntil,
    };
  };

  // Filter, search, and sort
  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    // Apply view filter based on filterExpired checkbox
    if (filterExpired) {
      // Show expired only: LATEST certificate per person+category if expired
      // Step 1: Group by person (DNI) + base category (same as backend logic)
      const grouped = new Map<string, CertificateEntry[]>();

      for (const entry of entries) {
        const baseCategory = extractBaseCategory(entry.category);
        // Use DNI for grouping, fallback to email if DNI not available
        const groupKey = `${(entry as any).dni || entry.email}_${baseCategory}`;

        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, []);
        }
        grouped.get(groupKey)!.push(entry);
      }

      // Step 2: For each group, select the LATEST certificate (by year in category name)
      const latestPerGroup = new Map<string, CertificateEntry>();
      for (const [groupKey, groupEntries] of grouped) {
        const latest = groupEntries.reduce((latest, current) => {
          const latestYear = extractYearFromCategory(latest.category) || 0;
          const currentYear = extractYearFromCategory(current.category) || 0;
          return currentYear > latestYear ? current : latest;
        });
        latestPerGroup.set(groupKey, latest);
      }

      // Step 3: Check if the LATEST is expired (including today - 0 days)
      const latestEntries = Array.from(latestPerGroup.values());
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      result = latestEntries.filter((entry) => {
        const expirationDate = new Date(entry.expirationDate);
        expirationDate.setHours(0, 0, 0, 0);
        // Include expired (days < 0) AND expiring today (days === 0)
        return expirationDate <= today;
      });
    } else {
      // Default view: Show LATEST certificate per person+category (both valid and expired)
      // Step 1: Group by person (DNI) + base category
      const grouped = new Map<string, CertificateEntry[]>();
      for (const entry of entries) {
        const baseCategory = extractBaseCategory(entry.category);
        const groupKey = `${(entry as any).dni || entry.email}_${baseCategory}`;
        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, []);
        }
        grouped.get(groupKey)!.push(entry);
      }

      // Step 2: Select LATEST certificate per group (by year in category name)
      const latestPerGroup = new Map<string, CertificateEntry>();
      for (const [groupKey, groupEntries] of grouped) {
        const latest = groupEntries.reduce((latest, current) => {
          const latestYear = extractYearFromCategory(latest.category) || 0;
          const currentYear = extractYearFromCategory(current.category) || 0;
          return currentYear > latestYear ? current : latest;
        });
        latestPerGroup.set(groupKey, latest);
      }

      // Step 3: Show ALL latest certificates (no validity filter)
      result = Array.from(latestPerGroup.values());
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (entry) =>
          (entry as any).name?.toLowerCase().includes(query) ||
          entry.email.toLowerCase().includes(query) ||
          entry.id.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'name':
          aVal = (a as any).name || '';
          bVal = (b as any).name || '';
          break;
        case 'category':
          aVal = a.category;
          bVal = b.category;
          break;
        case 'expirationDate':
          aVal = new Date(a.expirationDate).getTime();
          bVal = new Date(b.expirationDate).getTime();
          break;
        case 'email':
          aVal = a.email;
          bVal = b.email;
          break;
        case 'position':
          aVal = (a as any).position || '';
          bVal = (b as any).position || '';
          break;
        case 'year':
          aVal = extractYearFromCategory(a.category) || 0;
          bVal = extractYearFromCategory(b.category) || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [entries, filterExpired, searchQuery, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedEntries.length / itemsPerPage);
  const paginatedEntries = filteredAndSortedEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Check if new format fields exist
  const hasNewFields = entries.some(
    (e) => (e as any).name || (e as any).position || (e as any).startDate
  );

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterExpired}
              onChange={(e) => {
                setFilterExpired(e.target.checked);
                setCurrentPage(1);
              }}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show expired only</span>
          </label>
          <span className="text-sm text-gray-500">
            {!filterExpired && (
              <span>
                Showing {filteredAndSortedEntries.length} latest certificates (of {entries.length} total)
              </span>
            )}
            {filterExpired && (
              <span>
                Showing {filteredAndSortedEntries.length} expired certificates (of {entries.length} total)
              </span>
            )}
          </span>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64 text-black placeholder-gray-500"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                ID <SortIcon field="name" />
              </th>
              {hasNewFields && (
                <>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    Name <SortIcon field="name" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('position')}
                  >
                    Position <SortIcon field="position" />
                  </th>
                </>
              )}
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('category')}
              >
                Category <SortIcon field="category" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('year')}
              >
                Year <SortIcon field="year" />
              </th>
              {hasNewFields && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start Date
                </th>
              )}
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('email')}
              >
                Email <SortIcon field="email" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('expirationDate')}
              >
                Expiration Date <SortIcon field="expirationDate" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Days Until
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              {hasNewFields && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiration Reason
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedEntries.map((entry, index) => {
              const daysUntil = getDaysUntil(entry.expirationDate);
              const expirationStatus = getExpirationStatus(entry);
              const year = extractYearFromCategory(entry.category);

              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{entry.id}</td>
                  {hasNewFields && (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-900">{(entry as any).name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{(entry as any).position || '-'}</td>
                    </>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-900">{entry.category}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{year || '-'}</td>
                  {hasNewFields && (
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {(entry as any).startDate ? formatDate((entry as any).startDate) : '-'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-600">{entry.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(entry.expirationDate)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `${daysUntil} days`}
                  </td>
                  <td className="px-4 py-3">{expirationStatus.badge}</td>
                  {hasNewFields && (
                    <td className="px-4 py-3 text-sm text-gray-600">{expirationStatus.reason || '-'}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedEntries.length)} of {filteredAndSortedEntries.length} entries
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
