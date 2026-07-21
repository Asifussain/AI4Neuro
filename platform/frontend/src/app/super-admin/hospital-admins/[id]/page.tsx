'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  Brain,
  Building2,
  Clock,
  FileCheck,
  Stethoscope,
  Users,
  Waves,
} from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import {
  DashboardPageHeader,
  DonutLegend,
  DonutStat,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { SessionsTable } from '@/components/dashboards/shared/SessionsTable';
import { adminApi, type HospitalAdminProfileDetail } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{value || 'Not provided'}</span>
    </div>
  );
}

function HospitalAdminProfilePageInner() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);

  const [admin, setAdmin] = useState<HospitalAdminProfileDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .hospitalAdminProfile(id)
      .then((a) => !cancelled && setAdmin(a))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loading = admin === null && !error;
  const initials = (admin?.full_name || '??')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const modalitySegments = admin
    ? [
        { name: 'MRI', value: admin.mri_count, color: '#0d9488' },
        { name: 'EEG', value: admin.eeg_count, color: '#2563eb' },
      ].filter((s) => s.value > 0)
    : [];

  return (
    <>
      <DashboardPageHeader
        eyebrow="Super Admin · Hospital Admin Profile"
        title={loading ? 'Loading…' : admin?.full_name || 'Hospital Admin'}
        description="Read-only view of this hospital admin's complete hospital dashboard."
        accent="indigo"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load hospital admin profile: {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : admin ? (
        <>
          <SectionCard className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-900">{admin.full_name}</h2>
                  <StatusBadge status={admin.account_status} />
                  {admin.hospital_status && <StatusBadge status={admin.hospital_status} />}
                </div>
                <p className="text-sm text-slate-500 mt-1">{admin.email} · {admin.phone}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href="#activity" className="px-4 py-2 rounded-xl text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  Recent Activity
                </a>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            <StatCard label="Doctors" value={admin.doctor_count} icon={Stethoscope} accent="indigo" />
            <StatCard label="Radiologists" value={admin.radiologist_count} icon={Brain} accent="teal" />
            <StatCard label="Patients" value={admin.patient_count} icon={Users} accent="blue" />
            <StatCard label="MRI Analyses" value={admin.mri_count} icon={Brain} accent="teal" />
            <StatCard label="EEG Analyses" value={admin.eeg_count} icon={Waves} accent="blue" />
            <StatCard label="Reports Generated" value={admin.reports_generated} icon={FileCheck} accent="indigo" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-teal-600" />
                Hospital Details
              </h3>
              <div className="space-y-2">
                <InfoRow label="Hospital" value={admin.hospital_name} />
                <InfoRow label="Hospital Code" value={admin.hospital_code} />
                <InfoRow label="Address" value={admin.hospital_address} />
                <InfoRow label="Status" value={admin.hospital_status} />
              </div>
            </SectionCard>

            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Hospital Analytics</h3>
              <p className="text-xs text-slate-500 mb-3">MRI vs EEG split</p>
              {modalitySegments.length > 0 ? (
                <>
                  <DonutStat centerLabel="AI" segments={modalitySegments} />
                  <DonutLegend segments={modalitySegments} />
                </>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-sm text-slate-400">
                  No analyses yet
                </div>
              )}
            </SectionCard>

            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-amber-500" />
                Report Status
              </h3>
              <div className="space-y-2">
                <InfoRow label="Completed" value={admin.reports_generated} />
                <InfoRow label="Pending" value={admin.pending_reports} />
              </div>
            </SectionCard>
          </div>

          <SectionCard id="activity" className="p-5 scroll-mt-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-indigo-600" />
              Recent Activity
            </h3>
            <SessionsTable
              sessions={admin.recent_sessions}
              accent="indigo"
              showDeleteAction={false}
              emptyLabel="No analyses recorded for this hospital yet."
            />
          </SectionCard>
        </>
      ) : null}
    </>
  );
}

function HospitalAdminProfilePage() {
  return (
    <RoleShell>
      <HospitalAdminProfilePageInner />
    </RoleShell>
  );
}

export default withAuth(HospitalAdminProfilePage, { allowedRoles: ['super_admin'] });
