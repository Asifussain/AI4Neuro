'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { SectionCard, DashboardPageHeader } from '@/components/dashboards/shared/primitives';
import { SessionsTable } from '@/components/dashboards/shared/SessionsTable';
import { useAuth } from '@/components/providers/AuthProvider';
import { analysisApi } from '@/features/analysis/api';
import { adminApi } from '@/features/admin/api';
import type { SessionStatusResponse } from '@/features/analysis/types';
import type { Role } from '@/lib/roles';
import { withAuth } from '@/lib/withAuth';

function SearchInner() {
  const searchParams = useSearchParams();
  const q = (searchParams.get('q') || '').trim();
  const { userProfile } = useAuth();
  const role = (userProfile?.role ?? 'patient') as Role;

  const [sessions, setSessions] = useState<SessionStatusResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patientNameById, setPatientNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    analysisApi
      .list({ limit: 100 })
      .then((rows) => !cancelled && setSessions(rows))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (role === 'patient') return;
    let cancelled = false;
    const fetchPatients =
      role === 'doctor' ? adminApi.myPatients({ limit: 200 }) : adminApi.patients({ limit: 200 });
    fetchPatients
      .then((r) => {
        if (cancelled) return;
        setPatientNameById(Object.fromEntries(r.items.map((p) => [p.id, p.full_name])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [role]);

  const results = useMemo(() => {
    const all = sessions ?? [];
    const term = q.toLowerCase();
    if (!term) return all;
    return all.filter(
      (s) =>
        s.id.toLowerCase().includes(term) ||
        s.modality.toLowerCase().includes(term) ||
        s.status.toLowerCase().includes(term) ||
        s.analysis_type.toLowerCase().includes(term)
    );
  }, [sessions, q]);

  const loading = sessions === null && !error;

  return (
    <>
      <DashboardPageHeader
        eyebrow="Search"
        title={q ? `Results for “${q}”` : 'Search'}
        description="Find analyses by session ID, modality, analysis type, or status."
        accent="indigo"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Search failed: {error}
        </div>
      )}

      <SectionCard className="p-5">
        <p className="text-sm text-slate-500 mb-4">
          {loading ? 'Searching…' : `${results.length} result${results.length === 1 ? '' : 's'}`}
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : (
          <SessionsTable
            sessions={results}
            accent="indigo"
            patientNameById={patientNameById}
            showPatientColumn={role !== 'patient'}
            emptyLabel="No analyses match your search."
          />
        )}
      </SectionCard>
    </>
  );
}

function SearchPage() {
  return (
    <RoleShell>
      <Suspense fallback={<div className="h-40" />}>
        <SearchInner />
      </Suspense>
    </RoleShell>
  );
}

export default withAuth(SearchPage);
