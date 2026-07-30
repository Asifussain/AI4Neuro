'use client';

import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { SectionCard, DashboardPageHeader } from '@/components/dashboards/shared/primitives';
import { adminApi, type PlatformAnalytics, type Hospital } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

function AnalyticsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalId, setHospitalId] = useState('');
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('hospital_id');
    if (initial) setHospitalId(initial);
    adminApi
      .hospitals({ limit: 200 })
      .then((r) => setHospitals(r.items))
      .catch(() => setHospitals([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .platformAnalytics(hospitalId || undefined)
      .then((a) => {
        if (cancelled) return;
        setAnalytics(a);
        setError(null);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [hospitalId]);

  const dailyTraffic = analytics?.daily_traffic ?? [];
  const chartData = dailyTraffic.map((d) => ({
    day: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    scans: d.scans,
  }));
  const totalScans = dailyTraffic.reduce((acc, d) => acc + d.scans, 0);

  return (
    <RoleShell>
      <DashboardPageHeader
        eyebrow="Super Admin"
        title="Full Analytics"
        description="Real scan traffic over the last 30 days, platform-wide or scoped to a single hospital."
        accent="indigo"
        timelineSteps={[
          { label: 'Super Admin', href: '/super-admin/dashboard' },
          { label: 'Full Analytics', active: true },
        ]}
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load analytics: {error}
        </div>
      )}

      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Scan Traffic (Last 30 Days){analytics?.hospital_name ? ` — ${analytics.hospital_name}` : ' — All Hospitals'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{totalScans.toLocaleString()} total scans</p>
          </div>
          <select
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            className="py-2 pl-3 pr-8 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">All Hospitals</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorScansIndigo" x1="0" y1="0" x2="0" y2="1">
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
                allowDecimals={false}
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
                dataKey="scans"
                stroke="#4f46e5"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorScansIndigo)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
    </RoleShell>
  );
}

export default withAuth(AnalyticsPage, { allowedRoles: ['super_admin'] });
