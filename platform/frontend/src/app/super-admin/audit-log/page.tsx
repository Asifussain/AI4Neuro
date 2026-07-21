'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, History, RefreshCw } from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import {
  SectionCard,
  DashboardPageHeader,
  Pagination,
  usePaginatedList,
  formatAuditAction,
} from '@/components/dashboards/shared/primitives';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adminApi, type AuditLogEntry } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

const PAGE_SIZE = 15;

const ACTOR_ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Hospital Admin',
  doctor: 'Doctor',
  radiologist: 'Radiologist',
  patient: 'Patient',
};

function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [actorRoleFilter, setActorRoleFilter] = useState<string>('all');

  const load = useCallback(() => {
    adminApi
      .auditLog({ limit: 200 })
      .then((r) => {
        setEntries(r.items);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const all = entries ?? [];
    const term = q.trim().toLowerCase();
    let result = all;
    if (term) {
      result = result.filter(
        (e) => e.action.toLowerCase().includes(term) || (e.target_table ?? '').toLowerCase().includes(term)
      );
    }
    if (actorRoleFilter !== 'all') {
      result = result.filter((e) => e.actor_role === actorRoleFilter);
    }
    return result;
  }, [entries, q, actorRoleFilter]);

  const { page, setPage, totalPages, paginated, resetPage } = usePaginatedList(filtered, PAGE_SIZE);

  const updateFilter = useCallback(
    <T,>(setter: (v: T) => void, value: T) => {
      setter(value);
      resetPage();
    },
    [resetPage]
  );

  const loading = entries === null && !error;
  const activeFilterCount = [actorRoleFilter !== 'all', q !== ''].filter(Boolean).length;

  return (
    <RoleShell>
      <DashboardPageHeader
        eyebrow="Super Admin"
        title="Audit Log"
        description="A record of every hospital and user management action taken on the platform."
        accent="indigo"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between gap-3">
          <span>Failed to load the audit log: {error}</span>
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      <SectionCard className="p-5">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <label htmlFor="audit-log-search" className="sr-only">
                Search actions
              </label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="audit-log-search"
                value={q}
                onChange={(e) => updateFilter(setQ, e.target.value)}
                placeholder="Search by action or table…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <Select value={actorRoleFilter} onValueChange={(v) => updateFilter(setActorRoleFilter, v)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Actor role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actor roles</SelectItem>
                {Object.entries(ACTOR_ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-slate-500">
            {loading
              ? 'Loading…'
              : `${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}${
                  activeFilterCount > 0 ? ` (filtered from ${entries?.length ?? 0})` : ''
                }`}
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <History className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">{activeFilterCount > 0 ? 'No entries match your filters.' : 'No activity recorded yet.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2.5 pr-4 font-medium">Action</th>
                  <th className="py-2.5 pr-4 font-medium hidden md:table-cell">Target</th>
                  <th className="py-2.5 pr-4 font-medium">Actor Role</th>
                  <th className="py-2.5 pr-4 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium text-slate-900">{formatAuditAction(entry.action)}</td>
                    <td className="py-3 pr-4 hidden md:table-cell text-slate-500 font-mono text-xs">
                      {entry.target_table ?? '—'}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {ACTOR_ROLE_LABELS[entry.actor_role ?? ''] ?? entry.actor_role ?? 'Unknown'}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 text-xs">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </SectionCard>
    </RoleShell>
  );
}

export default withAuth(AuditLogPage, { allowedRoles: ['super_admin'] });
