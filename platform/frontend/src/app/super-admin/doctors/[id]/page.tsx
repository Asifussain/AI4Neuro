'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { SessionsTable } from '@/components/dashboards/shared/SessionsTable';
import { adminApi, type DoctorProfileDetail } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{value || 'Not provided'}</span>
    </div>
  );
}

function DoctorProfilePageInner() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);

  const [doctor, setDoctor] = useState<DoctorProfileDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .doctorProfile(id)
      .then((d) => !cancelled && setDoctor(d))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loading = doctor === null && !error;
  const initials = (doctor?.full_name || '??')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <DashboardPageHeader
        eyebrow="Super Admin · Doctor Profile"
        title={loading ? 'Loading…' : doctor?.full_name || 'Doctor'}
        description="Full read-only view of this doctor's care team, activity, and reports."
        accent="indigo"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load doctor profile: {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : doctor ? (
        <>
          <SectionCard className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-900">{doctor.full_name}</h2>
                  <StatusBadge status={doctor.account_status} />
                  {doctor.verification_status && <StatusBadge status={doctor.verification_status} />}
                </div>
                <p className="text-sm text-slate-500 mt-1">{doctor.email} · {doctor.phone}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href="#patients" className="px-4 py-2 rounded-xl text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  View Patients
                </a>
                <a href="#reports" className="px-4 py-2 rounded-xl text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  View Reports
                </a>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <StatCard label="Patients" value={doctor.patient_count} icon={Users} accent="indigo" />
            <StatCard label="MRI Scans" value={doctor.mri_count} icon={Brain} accent="teal" />
            <StatCard label="EEG Scans" value={doctor.eeg_count} icon={Waves} accent="blue" />
            <StatCard label="Pending Reports" value={doctor.pending_reports} icon={Clock} accent="indigo" />
            <StatCard label="Completed Reports" value={doctor.completed_reports} icon={FileCheck} accent="indigo" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Stethoscope className="h-4 w-4 text-indigo-600" />
                Doctor Information
              </h3>
              <div className="space-y-2">
                <InfoRow label="Specialization" value={doctor.specialization} />
                <InfoRow label="Qualification" value={doctor.qualification_name} />
                <InfoRow label="Medical License" value={doctor.medical_license} />
                <InfoRow label="Experience" value={doctor.experience_years ? `${doctor.experience_years} years` : null} />
              </div>
            </SectionCard>

            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-teal-600" />
                Assigned Hospital
              </h3>
              <div className="space-y-2">
                <InfoRow label="Hospital" value={doctor.hospital_name} />
                <InfoRow label="Hospital Admin" value={doctor.hospital_admin_name} />
              </div>
            </SectionCard>
          </div>

          <SectionCard id="patients" className="p-5 scroll-mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                Complete Patient List ({doctor.patient_count})
              </h3>
            </div>
            {doctor.patients.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No patients assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {doctor.patients.map((p) => (
                  <Link
                    key={p.id}
                    href={`/super-admin/patients/${p.id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{p.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {[p.patient_code, p.email].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <StatusBadge status={p.account_status} />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard id="reports" className="p-5 scroll-mt-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-indigo-600" />
              Recent Activity
            </h3>
            <SessionsTable
              sessions={doctor.recent_sessions}
              accent="indigo"
              showDeleteAction={false}
              patientNameById={Object.fromEntries(doctor.patients.map((p) => [p.id, p.full_name]))}
              emptyLabel="No analyses recorded for this doctor yet."
            />
          </SectionCard>
        </>
      ) : null}
    </>
  );
}

function DoctorProfilePage() {
  return (
    <RoleShell>
      <DoctorProfilePageInner />
    </RoleShell>
  );
}

export default withAuth(DoctorProfilePage, { allowedRoles: ['super_admin'] });
