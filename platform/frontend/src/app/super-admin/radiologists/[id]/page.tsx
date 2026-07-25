'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  Award,
  Brain,
  Building2,
  Clock,
  FileCheck,
  ScanLine,
  Waves,
} from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import {
  DashboardPageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { SessionsTable } from '@/components/dashboards/shared/SessionsTable';
import { adminApi, type RadiologistProfileDetail } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{value || 'Not provided'}</span>
    </div>
  );
}

function RadiologistProfilePageInner() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);

  const [radiologist, setRadiologist] = useState<RadiologistProfileDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .radiologistProfile(id)
      .then((r) => !cancelled && setRadiologist(r))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loading = radiologist === null && !error;
  const initials = (radiologist?.full_name || '??')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const totalProcessed = (radiologist?.mri_count ?? 0) + (radiologist?.eeg_count ?? 0);

  return (
    <>
      <DashboardPageHeader
        eyebrow="Super Admin · Radiologist Profile"
        title={loading ? 'Loading…' : radiologist?.full_name || 'Radiologist'}
        description="Full read-only view of this radiologist's imaging workload and reports."
        accent="indigo"
        timelineSteps={
          radiologist
            ? [
                { label: 'Super Admin', href: '/super-admin/dashboard' },
                { label: 'Hospitals', href: '/super-admin/hospitals' },
                { label: radiologist.hospital_name || 'Hospital', href: radiologist.hospital_id ? `/super-admin/hospitals/${radiologist.hospital_id}` : undefined },
                {
                  label: 'Radiologists',
                  href: radiologist.hospital_id
                    ? `/super-admin/users?hospital=${radiologist.hospital_id}&role=radiologist`
                    : '/super-admin/users?role=radiologist',
                },
                { label: radiologist.full_name, active: true },
              ]
            : [
                { label: 'Super Admin', href: '/super-admin/dashboard' },
                { label: 'Radiologist Profile', active: true },
              ]
        }
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load radiologist profile: {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : radiologist ? (
        <>
          <SectionCard className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-900">{radiologist.full_name}</h2>
                  <StatusBadge status={radiologist.account_status} />
                  {radiologist.verification_status && <StatusBadge status={radiologist.verification_status} />}
                </div>
                <p className="text-sm text-slate-500 mt-1">{radiologist.email} · {radiologist.phone}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href="#reports" className="px-4 py-2 rounded-xl text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  View Reports
                </a>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total Processed" value={totalProcessed} icon={ScanLine} accent="indigo" />
            <StatCard label="MRI Scans" value={radiologist.mri_count} icon={Brain} accent="teal" />
            <StatCard label="EEG Scans" value={radiologist.eeg_count} icon={Waves} accent="blue" />
            <StatCard label="Pending Reports" value={radiologist.pending_reports} icon={Clock} accent="indigo" />
            <StatCard label="Completed Reports" value={radiologist.completed_reports} icon={FileCheck} accent="indigo" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Award className="h-4 w-4 text-indigo-600" />
                Radiologist Information
              </h3>
              <div className="space-y-2">
                <InfoRow label="Imaging Expertise" value={radiologist.imaging_expertise} />
                <InfoRow label="Certifications" value={radiologist.certifications} />
                <InfoRow label="Qualification" value={radiologist.qualification_name} />
                <InfoRow label="License" value={radiologist.radiologist_license} />
                <InfoRow label="Experience" value={radiologist.experience_years ? `${radiologist.experience_years} years` : null} />
              </div>
            </SectionCard>

            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-teal-600" />
                Assigned Hospital
              </h3>
              <div className="space-y-2">
                <InfoRow label="Hospital" value={radiologist.hospital_name} />
              </div>
            </SectionCard>
          </div>

          <SectionCard id="reports" className="p-5 scroll-mt-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-indigo-600" />
              Recent Reports &amp; Processing Statistics
            </h3>
            <SessionsTable
              sessions={radiologist.recent_sessions}
              accent="indigo"
              showDeleteAction={false}
              patientNameById={radiologist.patient_names ?? {}}
              emptyLabel="No scans processed by this radiologist yet."
            />
          </SectionCard>
        </>
      ) : null}
    </>
  );
}

function RadiologistProfilePage() {
  return (
    <RoleShell>
      <RadiologistProfilePageInner />
    </RoleShell>
  );
}

export default withAuth(RadiologistProfilePage, { allowedRoles: ['super_admin'] });
