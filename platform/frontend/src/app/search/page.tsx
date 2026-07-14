'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, Brain, Waves } from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import {
  SectionCard,
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { analysisApi } from '@/features/analysis/api';
import type { SessionStatusResponse } from '@/features/analysis/types';
import { withAuth } from '@/lib/withAuth';

function SearchInner() {
  const searchParams = useSearchParams();
  const q = (searchParams.get('q') || '').trim();

  const [sessions, setSessions] = useState<SessionStatusResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        routeChip="/search"
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
        ) : results.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <SearchIcon className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No analyses match your search.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((s) => {
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
                      <p className="text-xs text-slate-400 font-mono truncate">{s.id}</p>
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
