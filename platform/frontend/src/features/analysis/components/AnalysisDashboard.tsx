'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  Clock,
  Upload,
  CalendarDays,
} from 'lucide-react';

import { useAuth } from '@/components/providers/AuthProvider';
import { analysisApi } from '@/features/analysis/api';
import { adminApi } from '@/features/admin/api';
import { isActive } from '@/features/analysis/types';
import { getRoleMeta, type Role } from '@/lib/navigation';
import {
  SectionCard,
  StatCard,
  QuickActionsList,
  DashboardPageHeader,
  MiniBarChart,
  DonutStat,
  DonutLegend,
} from '@/components/dashboards/shared/primitives';
import { SessionsTable } from '@/components/dashboards/shared/SessionsTable';
import { ActivityCalendar } from '@/components/dashboards/shared/ActivityCalendar';

const ROLE_COPY: Record<Role, { eyebrow: string; title: string; description: string }> = {
  super_admin: {
    eyebrow: 'Super Admin',
    title: 'Analysis Overview',
    description: 'EEG and MRI analysis activity across every hospital.',
  },
  admin: {
    eyebrow: 'Hospital Admin',
    title: 'Hospital Analyses',
    description: 'Monitor EEG and MRI analysis activity across your hospital.',
  },
  radiologist: {
    eyebrow: 'Radiologist',
    title: 'Radiologist Dashboard',
    description: 'Upload scans, review AI output, and track imaging analyses.',
  },
  doctor: {
    eyebrow: 'Doctor',
    title: 'Doctor Dashboard',
    description: 'Review assigned patient analyses, reports, and modality findings.',
  },
  patient: {
    eyebrow: 'Patient',
    title: 'My Analyses',
    description: 'View completed analysis reports shared by your care team.',
  },
};

function dayKey(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Role dashboard body backed by the unified backend analysis API. Shares the
 * same primitives (StatCard / DonutStat / MiniBarChart / SectionCard) as the
 * Super Admin and Hospital Admin dashboards so every role reads as one product.
 */
export function AnalysisDashboard() {
  const { userProfile } = useAuth();
  const role = (userProfile?.role ?? 'patient') as Role;
  const meta = getRoleMeta(role);
  const copy = ROLE_COPY[role] ?? ROLE_COPY.patient;
  const canCreate = role !== 'patient';
  // Each role's real "all sessions" list page — distinct from /analysis/new,
  // which only starts a fresh analysis and has nothing to do with viewing
  // existing ones.
  const ALL_ANALYSES_HREF: Partial<Record<Role, string>> = {
    admin: '/admin/sessions',
    doctor: '/doctor/sessions',
    radiologist: '/radiologist/sessions',
  };
  const allAnalysesHref = ALL_ANALYSES_HREF[role] ?? '/search';

  const [showCalendar, setShowCalendar] = useState(false);

  // Migrated onto TanStack Query — see QueryProvider for why only this
  // component has been moved onto it so far (foundational adoption, not a
  // full app-wide migration in one pass). Behavior is unchanged: same data
  // shape, same loading/error semantics the rest of this component reads.
  const {
    data: sessions,
    error: sessionsError,
  } = useQuery({
    queryKey: ['analysis-sessions', 'dashboard'],
    queryFn: () => analysisApi.list({ limit: 100 }),
  });
  const error = sessionsError ? (sessionsError as Error).message : null;

  // Best-effort patient-name lookup for the Recent Analyses table. The patient
  // role only sees their own analyses (no patient column), so skip the fetch;
  // doctors use their assigned-patients endpoint, other staff the hospital
  // directory. Any permission/network failure just falls back to a placeholder.
  const { data: patientNameByIdData } = useQuery({
    queryKey: ['patient-directory', role],
    queryFn: async () => {
      const r = role === 'doctor' ? await adminApi.myPatients({ limit: 200 }) : await adminApi.patients({ limit: 200 });
      return Object.fromEntries(r.items.map((p) => [p.id, p.full_name])) as Record<string, string>;
    },
    enabled: role !== 'patient',
    retry: false,
  });
  const patientNameById = patientNameByIdData ?? {};

  const stats = useMemo(() => {
    const all = sessions ?? [];
    const total = all.length;
    const inProgress = all.filter((s) => isActive(s.status)).length;
    const completed = all.filter((s) => s.status === 'completed').length;
    const failed = all.filter((s) => s.status === 'failed' || s.status === 'cancelled').length;
    const mri = all.filter((s) => s.modality === 'mri').length;
    const eeg = all.filter((s) => s.modality === 'eeg').length;

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const completedThisWeek = all.filter(
      (s) => s.status === 'completed' && new Date(s.updated_at || s.created_at || 0) >= startOfWeek
    ).length;

    return { total, inProgress, completed, failed, mri, eeg, completedThisWeek };
  }, [sessions]);

  // Activity over the last 7 calendar days.
  const activityData = useMemo(() => {
    const buckets: { name: string; value: number }[] = [];
    const counts = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      counts.set(key, 0);
      buckets.push({ name: key, value: 0 });
    }
    (sessions ?? []).forEach((s) => {
      const key = dayKey(s.created_at);
      if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return buckets.map((b) => ({ name: b.name, value: counts.get(b.name) || 0 }));
  }, [sessions]);

  const modalitySegments = [
    { name: 'MRI', value: stats.mri, color: '#0d9488' },
    { name: 'EEG', value: stats.eeg, color: '#2563eb' },
  ].filter((s) => s.value > 0);

  const recent = useMemo(
    () =>
      [...(sessions ?? [])]
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
        .slice(0, 8),
    [sessions]
  );

  const loading = sessions === undefined && !error;

  return (
    <>
      <DashboardPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        accent={meta.accent}
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load analyses: {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Analyses" value={stats.total} icon={Activity} accent={meta.accent} isLoading={loading} />
        <StatCard label="In Progress" value={stats.inProgress} icon={Clock} accent={meta.accent} isLoading={loading} />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} accent={meta.accent} isLoading={loading} />
        <StatCard
          label="This Week"
          value={stats.completedThisWeek}
          icon={CalendarDays}
          accent={meta.accent}
          isLoading={loading}
          onClick={() => setShowCalendar(true)}
        />
      </div>

      {/* Analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Analysis Activity</h3>
          <p className="text-xs text-slate-500 mb-3">Last 7 days</p>
          <MiniBarChart data={activityData} color={meta.accent === 'green' ? '#059669' : meta.accent === 'blue' ? '#2563eb' : meta.accent === 'teal' ? '#0d9488' : '#4f46e5'} />
        </SectionCard>

        <SectionCard className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Modality Split</h3>
          <p className="text-xs text-slate-500 mb-3">MRI vs EEG</p>
          {modalitySegments.length > 0 ? (
            <>
              <DonutStat centerLabel="AI" segments={modalitySegments} />
              <DonutLegend segments={modalitySegments.map((s) => ({ ...s, value: s.value }))} />
            </>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-sm text-slate-400">
              No analyses yet
            </div>
          )}
        </SectionCard>

        <QuickActionsList
          accent={meta.accent}
          actions={
            canCreate
              ? [
                  { label: 'New MRI Analysis', href: '/analysis/new?modality=mri' },
                  { label: 'New EEG Analysis', href: '/analysis/new?modality=eeg' },
                  { label: 'View All Analyses', href: allAnalysesHref },
                ]
              : [{ label: 'View My Reports', href: '/patient/dashboard' }]
          }
        />
      </div>

      {/* Recent analyses */}
      <SectionCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Analyses</h3>
            <p className="text-xs text-slate-500">Sessions available to your role</p>
          </div>
          {canCreate && (
            <Link
              href="/analysis/new"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              <Upload className="h-3.5 w-3.5" />
              New Analysis
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <SessionsTable
            sessions={recent}
            accent={meta.accent}
            patientNameById={patientNameById}
            showPatientColumn={role !== 'patient'}
            showDeleteAction={role !== 'patient'}
            emptyLabel={canCreate ? 'No analyses found. Upload a new scan to get started.' : 'Your reports will appear here once available.'}
          />
        )}
      </SectionCard>

      {showCalendar && (
        <ActivityCalendar
          title={`${copy.eyebrow} Activity`}
          timestamps={(sessions ?? []).map((s) => s.created_at)}
          accent={meta.accent}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </>
  );
}
