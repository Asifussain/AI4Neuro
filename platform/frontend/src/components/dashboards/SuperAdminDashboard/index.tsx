'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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
import { analysisApi } from '@/features/analysis/api';
import type { SessionStatusResponse } from '@/features/analysis/types';
import { ScansStatusCalendar } from '@/components/dashboards/shared/ScansStatusCalendar';

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
  const [sessions, setSessions] = useState<SessionStatusResponse[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [scanScope, setScanScope] = useState<'all' | 'mine'>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [health, setHealth] = useState<{ api: HealthState; database: HealthState; storage: HealthState }>({
    api: 'checking',
    database: 'checking',
    storage: 'checking',
  });

  const loadSessions = useCallback(() => {
    setSessionsLoading(true);
    analysisApi
      .list({ limit: 200, mine: scanScope === 'mine', hospital_id: selectedHospitalId ?? undefined })
      .then((s) => {
        setSessions(s);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setSessionsLoading(false));
  }, [scanScope, selectedHospitalId]);

  const loadDashboard = useCallback(() => {
    Promise.all([
      adminApi.platformAnalytics(selectedHospitalId ?? undefined),
      adminApi.hospitals({ limit: 200 }),
    ])
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
  }, [selectedHospitalId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

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

  const dailyTraffic = analytics?.daily_traffic ?? [];
  const patientVisitsData = useMemo(
    () =>
      dailyTraffic.map((d) => ({
        day: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        date: d.date,
        visits: d.scans,
      })),
    [dailyTraffic]
  );
  const totalScansLast30Days = dailyTraffic.reduce((acc, d) => acc + d.scans, 0);
  const dailyAverageScans = dailyTraffic.length ? totalScansLast30Days / dailyTraffic.length : 0;
  const peakTrafficDay = dailyTraffic.reduce<typeof dailyTraffic[number] | null>(
    (max, d) => (!max || d.scans > max.scans ? d : max),
    null
  );
  // Real week-over-week trend: sum of the most recent 7 days vs. the 7 days before that.
  const scanVolumeTrendPct = (() => {
    if (dailyTraffic.length < 14) return null;
    const recent = dailyTraffic.slice(-7).reduce((acc, d) => acc + d.scans, 0);
    const prior = dailyTraffic.slice(-14, -7).reduce((acc, d) => acc + d.scans, 0);
    if (prior === 0) return recent > 0 ? 100 : 0;
    return ((recent - prior) / prior) * 100;
  })();

  const filteredSessions = useMemo(() => {
    if (!selectedCalendarDate) return sessions.slice(0, 5);
    const y = selectedCalendarDate.getFullYear();
    const m = selectedCalendarDate.getMonth();
    const d = selectedCalendarDate.getDate();
    return sessions.filter((s) => {
      if (!s.created_at) return false;
      const sd = new Date(s.created_at);
      return sd.getFullYear() === y && sd.getMonth() === m && sd.getDate() === d;
    });
  }, [sessions, selectedCalendarDate]);

  return (
    <DashboardShell roleLabel="Super Admin" accent="indigo" navItems={NAV_ITEMS}>
      <div className="space-y-8">
        <DashboardPageHeader
          eyebrow="Super Admin"
          title="Super Admin Dashboard"
          description="Platform-wide control for hospitals, hospital admins, and user directories across every tenant."
          accent="indigo"
        />

        <div className="flex items-center justify-end">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            Viewing
            <select
              value={selectedHospitalId ?? ''}
              onChange={(e) => setSelectedHospitalId(e.target.value || null)}
              className="py-2 pl-3 pr-8 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All Hospitals</option>
              {(hospitals ?? []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between gap-3">
            <span>Failed to load platform analytics: {error}</span>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={() => {
                loadDashboard();
                loadSessions();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Patient Visits Area Chart Section */}
        <FadeIn delay={0.06}>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <SectionCard className="p-5 xl:col-span-2 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Scan Traffic (Last 30 Days)</h3>
                    <p className="text-xs text-slate-500">
                      Daily analysis sessions{analytics?.hospital_name ? ` — ${analytics.hospital_name}` : ' across the platform'}
                    </p>
                  </div>
                  <Link
                    href={selectedHospitalId ? `/super-admin/analytics?hospital_id=${selectedHospitalId}` : '/super-admin/analytics'}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase hover:bg-indigo-100"
                  >
                    View Full Analytics →
                  </Link>
                </div>

                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={patientVisitsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVisitsIndigo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                        dy={8}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                        dx={-8}
                      />
                      <Tooltip
                        cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '3 3' }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900/95 backdrop-blur border border-slate-800 px-3 py-2 rounded-xl shadow-xl text-white">
                                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{label}</p>
                                <p className="text-xs font-black mt-0.5 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                  {payload[0].value} Scans
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="visits"
                        stroke="#4f46e5"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorVisitsIndigo)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </SectionCard>

            {/* Quick Metrics sidebar card */}
            <SectionCard className="p-5 xl:col-span-1 flex flex-col justify-between bg-gradient-to-br from-indigo-950 to-slate-950 text-white border border-indigo-500/20 shadow-md h-full">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    30-Day Traffic Summary
                  </span>
                  <h4 className="text-2xl font-black mt-1 text-white">
                    {totalScansLast30Days.toLocaleString()} Total Scans
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Based on real analysis sessions created in the last 30 days
                  </p>
                </div>

                <div className="border-t border-slate-800/80 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Daily Average</span>
                    <span className="text-xs font-bold text-indigo-400">
                      {dailyAverageScans.toFixed(1)} scans/day
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Peak Traffic Day</span>
                    <span className="text-xs font-bold text-white">
                      {peakTrafficDay && peakTrafficDay.scans > 0
                        ? new Date(peakTrafficDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {scanVolumeTrendPct !== null && (
                <div className="border-t border-slate-800/80 pt-4 mt-6">
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Scan Volume Trend</p>
                      <p className="text-[10px] text-slate-400">Last 7 days vs. the 7 days before</p>
                    </div>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded border ${
                        scanVolumeTrendPct >= 0
                          ? 'text-emerald-400 bg-emerald-950/50 border-emerald-900/50'
                          : 'text-red-400 bg-red-950/50 border-red-900/50'
                      }`}
                    >
                      {scanVolumeTrendPct >= 0 ? '+' : ''}
                      {scanVolumeTrendPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </FadeIn>

        {/* Stats — one unified grid: hero metrics first, breakdown below */}
        <FadeIn>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {selectedHospitalId ? (
              <StatCard
                label="Hospital Status"
                value={activeHospitals > 0 ? 'Active' : 'Inactive'}
                icon={CheckCircle2}
                accent="indigo"
                isLoading={loading}
                size="lg"
                href="/super-admin/hospitals"
                isMain={true}
                trendText={analytics?.hospital_name ?? undefined}
              />
            ) : (
              <StatCard label="Active Hospitals" value={activeHospitals} icon={CheckCircle2} accent="indigo" isLoading={loading} size="lg" href="/super-admin/hospitals" isMain={true} trendText="Healthy Status" />
            )}
            <StatCard label="Patients" value={roles.patient ?? 0} icon={UserRound} accent="indigo" isLoading={loading} size="lg" href="/super-admin/users?role=patient" trendText="Onboards Active" />
            <StatCard label="Doctors" value={roles.doctor ?? 0} icon={Stethoscope} accent="indigo" isLoading={loading} size="lg" href="/super-admin/users?role=doctor" trendText="Active Care Teams" />
            <StatCard label="Radiologists" value={roles.radiologist ?? 0} icon={Brain} accent="indigo" isLoading={loading} size="lg" href="/super-admin/users?role=radiologist" trendText="Reviewing Scans" />
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
              <p className="text-xs text-slate-500 mb-3">Active vs inactive tenants (platform-wide, unaffected by the hospital filter above)</p>
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

        {/* Scans Calendar & Status Activity */}
        <FadeIn delay={0.08}>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
            <div className="xl:col-span-1">
              <ScansStatusCalendar
                sessions={sessions}
                accent="indigo"
                selectedDate={selectedCalendarDate}
                onSelectDate={setSelectedCalendarDate}
              />
            </div>
            
            <SectionCard className="p-5 xl:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {selectedCalendarDate
                      ? `Scans on ${selectedCalendarDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}`
                      : 'Recent Analysis Sessions'}
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setScanScope('all')}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          scanScope === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        All Scans
                      </button>
                      <button
                        type="button"
                        onClick={() => setScanScope('mine')}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          scanScope === 'mine' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        My Scans
                      </button>
                    </div>
                    <Link href="/super-admin/scans" className="text-xs font-medium text-indigo-700">
                      View All Scans
                    </Link>
                  </div>
                </div>

                {sessionsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-sm text-slate-500 font-medium">
                      {scanScope === 'mine'
                        ? 'No scans performed by you found for this view.'
                        : 'No analysis sessions found for this day.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSessions.map((s: SessionStatusResponse) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-white border border-slate-200 shrink-0 text-slate-500 font-mono text-[10px] uppercase font-bold">
                            {s.modality}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                Session {s.id.slice(0, 8)}
                              </p>
                              {s.analysis_type && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  {s.analysis_type.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              Onboarded: {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={s.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        </FadeIn>

        {/* Hospitals + System Status/Activity */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <SectionCard className="p-5 xl:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Recent Hospitals</h3>
                  <p className="text-xs text-slate-400">Platform-wide, unaffected by the hospital filter above</p>
                </div>
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
