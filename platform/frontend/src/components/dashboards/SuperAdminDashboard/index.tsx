'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Landmark,
  ShieldCheck,
  Stethoscope,
  Brain,
  UserRound,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { DashboardShell, type NavItem } from '@/components/dashboards/shared/DashboardShell';
import {
  SectionCard,
  StatCard,
  QuickActionsList,
  AlertList,
  DashboardPageHeader,
  MiniBarChart,
  DonutStat,
  DonutLegend,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { getNavItems } from '@/lib/navigation';
import { adminApi, type PlatformAnalytics, type Hospital } from '@/features/admin/api';

const NAV_ITEMS: NavItem[] = getNavItems('super_admin');

export const SuperAdminDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([adminApi.platformAnalytics(), adminApi.hospitals()])
      .then(([a, h]) => {
        if (cancelled) return;
        setAnalytics(a);
        setHospitals(h);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = analytics === null && !error;
  const roles = analytics?.users_by_role ?? {};
  const totalHospitals = analytics?.total_hospitals ?? 0;
  const activeHospitals = analytics?.active_hospitals ?? 0;
  const inactiveHospitals = Math.max(0, totalHospitals - activeHospitals);

  const roleBars = [
    { name: 'Doctors', value: roles.doctor ?? 0 },
    { name: 'Radiologists', value: roles.radiologist ?? 0 },
    { name: 'Patients', value: roles.patient ?? 0 },
    { name: 'Admins', value: roles.hospital_admin ?? 0 },
  ];

  const hospitalSegments = [
    { name: 'Active', value: activeHospitals, color: '#0d9488' },
    { name: 'Inactive', value: inactiveHospitals, color: '#94a3b8' },
  ].filter((s) => s.value > 0);

  const recentHospitals = [...(hospitals ?? [])]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 4);

  return (
    <DashboardShell roleLabel="Super Admin" accent="indigo" navItems={NAV_ITEMS}>
      <DashboardPageHeader
        eyebrow="Super Admin"
        title="Super Admin Dashboard"
        description="Platform-wide control for hospitals, hospital admins, and user directories across every tenant."
        routeChip="/super-admin/dashboard"
        accent="indigo"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load platform analytics: {error}
        </div>
      )}

      {/* Stats — real counts from the backend analytics endpoint */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Hospitals" value={totalHospitals} icon={Building2} accent="indigo" isLoading={loading} />
        <StatCard label="Active Hospitals" value={activeHospitals} icon={CheckCircle2} accent="indigo" isLoading={loading} />
        <StatCard label="Total Users" value={analytics?.total_users ?? 0} icon={Users} accent="indigo" isLoading={loading} />
        <StatCard label="Doctors" value={roles.doctor ?? 0} icon={Stethoscope} accent="indigo" isLoading={loading} />
        <StatCard label="Radiologists" value={roles.radiologist ?? 0} icon={Brain} accent="indigo" isLoading={loading} />
        <StatCard label="Patients" value={roles.patient ?? 0} icon={UserRound} accent="indigo" isLoading={loading} />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <StatCard label="Hospital Admins" value={roles.hospital_admin ?? 0} icon={Landmark} accent="indigo" isLoading={loading} />
        <StatCard label="Super Admins" value={roles.super_admin ?? 0} icon={ShieldCheck} accent="indigo" isLoading={loading} />
      </div>

      {/* Analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Users by Role</h3>
          <p className="text-xs text-slate-500 mb-3">Platform-wide directory</p>
          <MiniBarChart data={roleBars} color="#4f46e5" />
        </SectionCard>

        <SectionCard className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Hospital Status</h3>
          <p className="text-xs text-slate-500 mb-3">Active vs inactive tenants</p>
          {hospitalSegments.length > 0 ? (
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
            { label: 'Manage Hospitals', href: '/super-admin/hospitals' },
            { label: 'Manage Hospital Admins', href: '/super-admin/users?role=hospital_admin' },
            { label: 'View Doctors', href: '/super-admin/users?role=doctor' },
            { label: 'View Radiologists', href: '/super-admin/users?role=radiologist' },
            { label: 'View Patients', href: '/super-admin/users?role=patient' },
          ]}
        />
      </div>

      {/* Hospitals + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Recent Hospitals</h3>
            <Link href="/super-admin/hospitals" className="text-xs font-medium text-indigo-700">
              View All
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}
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
                      <p className="text-xs text-slate-500 truncate">{h.hospital_code} · {h.address}</p>
                    </div>
                  </div>
                  <StatusBadge status={h.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <AlertList
          alerts={[
            {
              icon: BarChart3,
              tone: 'info',
              heading: 'Platform Directory',
              body: `${analytics?.total_users ?? 0} users across ${totalHospitals} hospitals.`,
            },
            {
              icon: activeHospitals < totalHospitals ? AlertTriangle : CheckCircle2,
              tone: activeHospitals < totalHospitals ? 'warning' : 'info',
              heading: 'Hospital Status',
              body: `${activeHospitals} active, ${inactiveHospitals} inactive.`,
            },
          ]}
        />
      </div>
    </DashboardShell>
  );
};
