'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Landmark,
  ShieldCheck,
  Stethoscope,
  Brain,
  UserRound,
  CheckCircle2,
  Server,
  Database,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { DashboardShell, type NavItem } from '@/components/dashboards/shared/DashboardShell';
import {
  SectionCard,
  StatCard,
  QuickActionsList,
  DashboardPageHeader,
  MiniBarChart,
  DonutStat,
  DonutLegend,
  StatusBadge,
  FadeIn,
  ACCENT_HEX,
  NEUTRAL_CHART_HEX,
} from '@/components/dashboards/shared/primitives';
import { Button } from '@/components/ui/button';
import { getNavItems } from '@/lib/navigation';
import { adminApi, type PlatformAnalytics, type Hospital } from '@/features/admin/api';
import { CreateUserDialog } from '@/components/dashboards/shared/CreateUserDialog';

const NAV_ITEMS: NavItem[] = getNavItems('super_admin');

type HealthState = 'ok' | 'not_configured' | 'unreachable' | 'checking';

function healthDot(state: HealthState) {
  if (state === 'ok') return 'bg-emerald-500';
  if (state === 'checking') return 'bg-slate-300 animate-pulse';
  if (state === 'not_configured') return 'bg-amber-500';
  return 'bg-red-500';
}

function healthLabel(state: HealthState) {
  if (state === 'ok') return 'Healthy';
  if (state === 'checking') return 'Checking…';
  if (state === 'not_configured') return 'Not configured';
  return 'Unreachable';
}

export const SuperAdminDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [health, setHealth] = useState<{ api: HealthState; database: HealthState; storage: HealthState }>({
    api: 'checking',
    database: 'checking',
    storage: 'checking',
  });

  const loadDashboard = useCallback(() => {
    Promise.all([adminApi.platformAnalytics(), adminApi.hospitals({ limit: 200 })])
      .then(([a, h]) => {
        setAnalytics(a);
        setHospitals(h.items);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));

    adminApi
      .health()
      .then((r) => setHealth((h) => ({ ...h, api: r.status === 'ok' ? 'ok' : 'unreachable' })))
      .catch(() => setHealth((h) => ({ ...h, api: 'unreachable' })));
    adminApi
      .healthDatabase()
      .then((r) => setHealth((h) => ({ ...h, database: r.status === 'ok' ? 'ok' : 'not_configured' })))
      .catch(() => setHealth((h) => ({ ...h, database: 'unreachable' })));
    adminApi
      .healthStorage()
      .then((r) => setHealth((h) => ({ ...h, storage: r.status === 'ok' ? 'ok' : 'not_configured' })))
      .catch(() => setHealth((h) => ({ ...h, storage: 'unreachable' })));
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const loading = analytics === null && !error;
  const roles = analytics?.users_by_role ?? {};
  const totalHospitals = analytics?.total_hospitals ?? 0;
  const activeHospitals = analytics?.active_hospitals ?? 0;
  const inactiveHospitals = Math.max(0, totalHospitals - activeHospitals);

  const roleBars = [
    { name: 'Doctors', value: roles.doctor ?? 0 },
    { name: 'Radiologists', value: roles.radiologist ?? 0 },
    { name: 'Patients', value: roles.patient ?? 0 },
    { name: 'Admins', value: roles.admin ?? 0 },
  ];

  const hospitalSegments = [
    { name: 'Active', value: activeHospitals, color: ACCENT_HEX.indigo },
    { name: 'Inactive', value: inactiveHospitals, color: NEUTRAL_CHART_HEX },
  ].filter((s) => s.value > 0);

  const recentHospitals = [...(hospitals ?? [])]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 4);

  return (
    <DashboardShell roleLabel="Super Admin" accent="indigo" navItems={NAV_ITEMS}>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <DashboardPageHeader
            eyebrow="Super Admin"
            title="Super Admin Dashboard"
            description="Platform-wide control for hospitals, hospital admins, and user directories across every tenant."
            accent="indigo"
          />
        </div>

        <div className="flex justify-end">
          <Button asChild className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Link href="/super-admin/hospitals">
              <Building2 className="h-4 w-4" />
              Onboard Hospital
            </Link>
          </Button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between gap-3">
            <span>Failed to load platform analytics: {error}</span>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={loadDashboard}>
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Stats — one unified grid: hero metrics first, breakdown below */}
        <FadeIn>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Hospitals" value={totalHospitals} icon={Building2} accent="indigo" isLoading={loading} size="lg" href="/super-admin/hospitals" />
            <StatCard label="Active Hospitals" value={activeHospitals} icon={CheckCircle2} accent="indigo" isLoading={loading} size="lg" href="/super-admin/hospitals" />
            <StatCard label="Total Users" value={analytics?.total_users ?? 0} icon={Users} accent="indigo" isLoading={loading} size="lg" href="/super-admin/users" />
            <StatCard label="Doctors" value={roles.doctor ?? 0} icon={Stethoscope} accent="indigo" isLoading={loading} size="lg" href="/super-admin/users?role=doctor" />
            <StatCard label="Radiologists" value={roles.radiologist ?? 0} icon={Brain} accent="indigo" isLoading={loading} href="/super-admin/users?role=radiologist" />
            <StatCard label="Patients" value={roles.patient ?? 0} icon={UserRound} accent="indigo" isLoading={loading} href="/super-admin/users?role=patient" />
            <StatCard label="Hospital Admins" value={roles.admin ?? 0} icon={Landmark} accent="indigo" isLoading={loading} href="/super-admin/users?role=admin" />
            <StatCard label="Super Admins" value={roles.super_admin ?? 0} icon={ShieldCheck} accent="indigo" isLoading={loading} href="/super-admin/users?role=super_admin" />
          </div>
        </FadeIn>

        {/* Analytics row */}
        <FadeIn delay={0.05}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <SectionCard className="p-5 xl:col-span-1">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Users by Role</h3>
              <p className="text-xs text-slate-500 mb-3">Platform-wide directory</p>
              <MiniBarChart data={roleBars} color={ACCENT_HEX.indigo} isLoading={loading} />
            </SectionCard>

            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Hospital Status</h3>
              <p className="text-xs text-slate-500 mb-3">Active vs inactive tenants</p>
              {loading ? (
                <DonutStat centerLabel="HQ" segments={[]} isLoading />
              ) : hospitalSegments.length > 0 ? (
                <>
                  <DonutStat centerLabel="HQ" segments={hospitalSegments} />
                  <DonutLegend segments={hospitalSegments.map((s) => ({ ...s, value: s.value }))} />
                </>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-sm text-slate-400">
                  No hospitals yet
                </div>
              )}
            </SectionCard>

            <QuickActionsList
              accent="indigo"
              actions={[
                { label: 'Add User', onClick: () => setCreateUserOpen(true) },
                { label: 'Manage Hospitals', href: '/super-admin/hospitals' },
                { label: 'Manage Hospital Admins', href: '/super-admin/users?role=admin' },
                { label: 'View Doctors', href: '/super-admin/users?role=doctor' },
                { label: 'View Radiologists', href: '/super-admin/users?role=radiologist' },
                { label: 'View Patients', href: '/super-admin/users?role=patient' },
              ]}
            />
          </div>
        </FadeIn>

        <CreateUserDialog
          open={createUserOpen}
          onOpenChange={setCreateUserOpen}
          allowedRoles={['doctor', 'radiologist', 'patient', 'admin', 'super_admin']}
          hospitals={hospitals ?? []}
          accent="indigo"
        />

        {/* Hospitals + System Status/Activity */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <SectionCard className="p-5 xl:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Recent Hospitals</h3>
                <Link href="/super-admin/hospitals" className="text-xs font-medium text-indigo-700">
                  View All
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : recentHospitals.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No hospitals onboarded yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentHospitals.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 rounded-lg bg-indigo-50 shrink-0">
                          <Building2 className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{h.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {h.hospital_code} · {h.address}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={h.status} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <div className="space-y-4">
              {/* System Status — live health checks, replacing the old static Alerts copy */}
              <SectionCard className="p-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <Server className="h-4 w-4 text-indigo-600" />
                  System Status
                </h3>
                <div className="space-y-2.5">
                  {[
                    { label: 'API', status: health.api, icon: Server },
                    { label: 'Database', status: health.database, icon: Database },
                    { label: 'Storage', status: health.storage, icon: HardDrive },
                  ].map(({ label, status: hStatus, icon: Icon }) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${healthDot(hStatus)}`} />
                        <span className="text-xs text-slate-800">{healthLabel(hStatus)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        </FadeIn>
      </div>
    </DashboardShell>
  );
};
