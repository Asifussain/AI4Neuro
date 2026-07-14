'use client';

import React from 'react';
import {
  Building2,
  Users,
  Database,
  Brain,
  Waves,
  IndianRupee,
  CheckCircle2,
  LayoutGrid,
  Landmark,
  ShieldCheck,
  Boxes,
  CreditCard,
  BarChart3,
  FileText,
  ClipboardList,
  Settings,
  AlertTriangle,
  Lock,
  Bell,
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
} from '@/components/dashboards/shared/primitives';

// This dashboard is UI-only for now (mock data), per product decision: real
// hospital/billing/audit data wiring is a follow-up once the Super Admin role
// and its backend endpoints exist.

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutGrid },
  { label: 'Hospitals', href: '/super-admin/dashboard', icon: Building2 },
  { label: 'Hospital Admins', href: '/super-admin/dashboard', icon: Landmark },
  { label: 'Services', href: '/super-admin/dashboard', icon: Boxes },
  { label: 'Subscriptions', href: '/super-admin/dashboard', icon: CreditCard },
  { label: 'Analytics', href: '/super-admin/dashboard', icon: BarChart3 },
  { label: 'Reports', href: '/super-admin/dashboard', icon: FileText },
  { label: 'Audit Logs', href: '/super-admin/dashboard', icon: ClipboardList },
  { label: 'Settings', href: '/profile', icon: Settings },
];

const SALES_USAGE = [
  { name: 'Jan', value: 18 },
  { name: 'Feb', value: 22 },
  { name: 'Mar', value: 27 },
  { name: 'Apr', value: 24 },
  { name: 'May', value: 31 },
  { name: 'Jun', value: 36 },
];

const DIAGNOSIS_SEGMENTS = [
  { name: 'MRI', value: 52, color: '#0d9488' },
  { name: 'EEG', value: 36, color: '#2563eb' },
  { name: 'PET', value: 12, color: '#7c3aed' },
];

export const SuperAdminDashboard: React.FC = () => {
  return (
    <DashboardShell roleLabel="Super Admin" accent="indigo" navItems={NAV_ITEMS}>
      <DashboardPageHeader
        eyebrow="Super Admin"
        title="Super Admin Dashboard"
        description="Platform-wide control for hospitals, hospital admins, scan usage, disk storage, and sales."
        routeChip="/super-admin-dashboard"
        accent="indigo"
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Admin Hospitals" value={28} icon={Building2} sublabel="+4 this quarter" accent="indigo" />
        <StatCard label="Hospital Admins" value={96} icon={Landmark} sublabel="+12 new admins" accent="indigo" />
        <StatCard label="Disk Storage Used" value="14.8 TB" icon={Database} sublabel="68% of capacity" accent="indigo" />
        <StatCard label="MRI Taken" value={8420} icon={Brain} sublabel="+11.4%" accent="indigo" />
        <StatCard label="EEG Taken" value={5870} icon={Waves} sublabel="+8.2%" accent="indigo" />
        <StatCard label="PET Taken" value={1940} icon={ShieldCheck} sublabel="+5.9%" accent="indigo" />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <StatCard label="Monthly Sales" value="₹42.8L" icon={IndianRupee} sublabel="+18.6%" accent="indigo" />
        <StatCard label="Active Plans" value={24} icon={CheckCircle2} sublabel="4 upgrades pending" accent="indigo" />
      </div>

      {/* Analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Sales &amp; Usage Graph</h3>
          <p className="text-xs text-slate-500 mb-3">Weekly scan activity</p>
          <MiniBarChart data={SALES_USAGE} color="#4f46e5" />
        </SectionCard>

        <SectionCard className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Diagnosis Distribution</h3>
          <p className="text-xs text-slate-500 mb-3">CN / MCI / AD</p>
          <DonutStat centerLabel="AI" segments={DIAGNOSIS_SEGMENTS} />
          <DonutLegend segments={DIAGNOSIS_SEGMENTS.map((s) => ({ ...s, value: `${s.value}%` }))} />
        </SectionCard>

        <QuickActionsList
          accent="indigo"
          actions={[
            { label: 'Add Hospital' },
            { label: 'Manage Hospital Admins' },
            { label: 'Upgrade Plan' },
            { label: 'Audit Storage' },
            { label: 'View Sales Report' },
          ]}
        />
      </div>

      {/* Subscription + Alerts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Subscription</h3>
          <p className="text-lg font-bold text-slate-900">Platform Master Console</p>
          <p className="text-sm text-slate-500 mt-1">16,230 scans processed</p>
          <p className="text-sm text-slate-500">7.2 TB remaining</p>
          <p className="text-xs text-indigo-700 font-medium mt-2">Renewal: Global billing cycle</p>
        </SectionCard>

        <AlertList
          alerts={[
            {
              icon: AlertTriangle,
              tone: 'warning',
              heading: 'Storage Watch',
              body: '3 hospitals are above 75% disk usage.',
            },
            {
              icon: BarChart3,
              tone: 'info',
              heading: 'Sales Target',
              body: 'Monthly sales graph is tracking 18.6% above last month.',
            },
            {
              icon: Lock,
              tone: 'purple',
              heading: 'PET Enablement',
              body: 'PET service is gated per-hospital via entitlements.',
            },
          ]}
        />

        <SectionCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Platform Activity</h3>
            <button className="text-xs font-medium text-indigo-700">View All</button>
          </div>
          <div className="space-y-2.5">
            {[
              { icon: Building2, text: 'New hospital "Sunrise Care" onboarded', time: '2h ago' },
              { icon: Users, text: 'Hospital Admin created for Metro Neuro', time: '5h ago' },
              { icon: Bell, text: 'Storage alert triggered for 2 hospitals', time: '1d ago' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-50 shrink-0">
                  <item.icon className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-800 truncate">{item.text}</p>
                  <p className="text-[10px] text-slate-400">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </DashboardShell>
  );
};
