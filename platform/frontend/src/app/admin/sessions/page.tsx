'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Brain, ScanLine, Waves } from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import {
  SectionCard,
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { analysisApi } from '@/features/analysis/api';
import type { SessionStatusResponse } from '@/features/analysis/types';
import { withAuth } from '@/lib/withAuth';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
] as const;

function SessionsInner() {
  const statusParam = useSearchParams().get('status') || undefined;

  const [sessions, setSessions] = useState<SessionStatusResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(statusParam);

  useEffect(() => {
    let cancelled = false;
    analysisApi
      .list({ limit: 200, status: statusFilter })
      .then((rows) => !cancelled && setSessions(rows))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const loading = sessions === null && !error;
  const rows = sessions ?? [];

  const isReportsView = statusParam === 'completed';

  return (
    <>
      <DashboardPageHeader
        eyebrow="Hospital Admin"
        title={isReportsView ? 'Reports' : 'Scan Sessions'}
        description={
          isReportsView
            ? 'Completed EEG and MRI analyses with generated reports.'
            : 'All EEG and MRI analysis sessions for your hospital.'
        }
        routeChip={`/admin/sessions${statusParam ? `?status=${statusParam}` : ''}`}
        accent="teal"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load sessions: {error}
        </div>
      )}

      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${rows.length} session${rows.length === 1 ? '' : 's'}`}
          </p>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-50 border border-slate-200 w-fit">
            {STATUS_FILTERS.map(({ value, label }) => (
              <button
                key={label}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  statusFilter === value
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <ScanLine className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No sessions found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((s) => {
              const ModalityIcon = s.modality === 'eeg' ? Waves : Brain;
              return (
                <Link
                  key={s.id}
                  href={`/analysis/${s.id}`}
                  className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-50 shrink-0">
                      <ModalityIcon className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        <span className="uppercase">{s.modality}</span> · {s.analysis_type}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>
    </>
  );
}

function SessionsPage() {
  return (
    <RoleShell>
      <Suspense fallback={<div className="h-40" />}>
        <SessionsInner />
      </Suspense>
    </RoleShell>
  );
}

export default withAuth(SessionsPage, { allowedRoles: ['admin'] });
