'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Brain,
  Waves,
  CheckCircle2,
  Clock,
  Upload,
  AlertCircle,
  Loader2,
  FileText,
  CalendarDays,
} from 'lucide-react';

import { useAuth } from '@/components/providers/AuthProvider';
import { analysisApi } from '@/features/analysis/api';
import { isActive, type SessionStatusResponse } from '@/features/analysis/types';
import { getRoleMeta, type Role } from '@/lib/navigation';
import {
  SectionCard,
  StatCard,
  QuickActionsList,
  DashboardPageHeader,
  MiniBarChart,
  DonutStat,
  DonutLegend,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';

const ROLE_COPY: Record<Role, { eyebrow: string; title: string; description: string }> = {
  super_admin: {
    eyebrow: 'Super Admin',
    title: 'Analysis Overview',
    description: 'EEG and MRI analysis activity across every hospital.',
  },
  hospital_admin: {
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

  const [sessions, setSessions] = useState<SessionStatusResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    analysisApi
      .list({ limit: 100 })
      .then((data) => !cancelled && setSessions(data))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

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

  const loading = sessions === null && !error;

  return (
    <>
      <DashboardPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        routeChip={meta.dashboard}
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
        <StatCard label="This Week" value={stats.completedThisWeek} icon={CalendarDays} accent={meta.accent} isLoading={loading} />
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
                  { label: 'View All Analyses', href: '/analysis/new' },
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
        ) : recent.length === 0 ? (
          <div className="text-center py-12">
            <div className="p-4 rounded-full bg-slate-100 w-fit mx-auto mb-4">
              <Brain className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-900 font-medium mb-1">No analyses found</p>
            <p className="text-sm text-slate-500">
              {canCreate ? 'Upload a new scan to get started.' : 'Your reports will appear here once available.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((s) => {
              const ModalityIcon = s.modality === 'eeg' ? Waves : Brain;
              const active = isActive(s.status);
              const failed = s.status === 'failed' || s.status === 'cancelled';
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
                      <p className="text-xs text-slate-500">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                        {s.current_stage ? ` · ${s.current_stage.replace(/_/g, ' ')}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {active && <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />}
                    {failed && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                    {s.status === 'completed' && <FileText className="h-3.5 w-3.5 text-emerald-600" />}
                    <StatusBadge status={s.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>
    </>
  );
}
