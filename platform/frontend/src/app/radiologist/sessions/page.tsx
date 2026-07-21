'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { SectionCard, DashboardPageHeader } from '@/components/dashboards/shared/primitives';
import { SessionsTable } from '@/components/dashboards/shared/SessionsTable';
import { analysisApi } from '@/features/analysis/api';
import { adminApi } from '@/features/admin/api';
import type { SessionStatusResponse } from '@/features/analysis/types';
import { withAuth } from '@/lib/withAuth';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
] as const;

function RadiologistSessionsInner() {
  const statusParam = useSearchParams().get('status') || undefined;

  const [sessions, setSessions] = useState<SessionStatusResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(statusParam);
  const [patientNameById, setPatientNameById] = useState<Record<string, string>>({});

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

  useEffect(() => {
    let cancelled = false;
    adminApi
      .patients({ limit: 200 })
      .then((r) => {
        if (cancelled) return;
        setPatientNameById(Object.fromEntries(r.items.map((p) => [p.id, p.full_name])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSessionDeleted = (deletedId: string) => {
    setSessions((prev) => (prev ? prev.filter((s) => s.id !== deletedId) : null));
  };

  const loading = sessions === null && !error;
  const rows = sessions ?? [];

  return (
    <>
      <DashboardPageHeader
        eyebrow="Radiologist"
        title="Scan Sessions"
        description="All EEG and MRI analysis sessions for your hospital."
        accent="indigo"
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
                    ? 'bg-indigo-50 text-indigo-700'
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
        ) : (
          <SessionsTable
            sessions={rows}
            accent="indigo"
            patientNameById={patientNameById}
            onSessionDeleted={handleSessionDeleted}
          />
        )}
      </SectionCard>
    </>
  );
}

function RadiologistSessionsPage() {
  return (
    <RoleShell>
      <Suspense fallback={<div className="h-40" />}>
        <RadiologistSessionsInner />
      </Suspense>
    </RoleShell>
  );
}

export default withAuth(RadiologistSessionsPage, { allowedRoles: ['radiologist', 'admin'] });
