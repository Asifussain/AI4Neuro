'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Brain,
  Building2,
  Calendar,
  Droplet,
  FileCheck,
  HeartPulse,
  Stethoscope,
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
import { adminApi, type PatientProfileDetail } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{value || 'Not provided'}</span>
    </div>
  );
}

function PatientProfilePageInner() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);

  const [patient, setPatient] = useState<PatientProfileDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .patientProfile(id)
      .then((p) => !cancelled && setPatient(p))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loading = patient === null && !error;
  const initials = (patient?.full_name || '??')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const timeline = patient
    ? [...patient.mri_sessions, ...patient.eeg_sessions].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )
    : [];

  return (
    <>
      <DashboardPageHeader
        eyebrow="Super Admin · Patient Profile"
        title={loading ? 'Loading…' : patient?.full_name || 'Patient'}
        description="Full read-only view of this patient's care team, scan history, and reports."
        accent="indigo"
        timelineSteps={
          patient
            ? [
                { label: 'Super Admin', href: '/super-admin/dashboard' },
                { label: 'Hospitals', href: '/super-admin/hospitals' },
                { label: patient.hospital_name || 'Hospital', href: patient.hospital_id ? `/super-admin/hospitals/${patient.hospital_id}` : undefined },
                {
                  label: 'Patients',
                  href: patient.hospital_id
                    ? `/super-admin/users?hospital=${patient.hospital_id}&role=patient`
                    : '/super-admin/users?role=patient',
                },
                { label: patient.full_name, active: true },
              ]
            : [
                { label: 'Super Admin', href: '/super-admin/dashboard' },
                { label: 'Patient Profile', active: true },
              ]
        }
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load patient profile: {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : patient ? (
        <>
          <SectionCard className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-900">{patient.full_name}</h2>
                  <StatusBadge status={patient.account_status} />
                </div>
                <p className="text-sm text-slate-500 mt-1">{patient.email} · {patient.phone}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href="#reports" className="px-4 py-2 rounded-xl text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  Download Reports
                </a>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="MRI Scans" value={patient.mri_sessions.length} icon={Brain} accent="teal" />
            <StatCard label="EEG Scans" value={patient.eeg_sessions.length} icon={Waves} accent="blue" />
            <StatCard label="Reports Generated" value={patient.reports_count} icon={FileCheck} accent="indigo" />
            <StatCard
              label="Blood Group"
              value={patient.blood_type || '—'}
              icon={Droplet}
              accent="indigo"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <HeartPulse className="h-4 w-4 text-red-500" />
                Medical Summary
              </h3>
              <div className="space-y-2">
                <InfoRow
                  label="Date of Birth"
                  value={patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : null}
                />
                <InfoRow label="Blood Group" value={patient.blood_type} />
                <InfoRow label="Emergency Contact" value={[patient.emergency_contact_name, patient.emergency_contact_phone].filter(Boolean).join(' · ')} />
                <InfoRow label="Patient Code" value={patient.patient_code} />
              </div>
            </SectionCard>

            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Stethoscope className="h-4 w-4 text-indigo-600" />
                Care Team
              </h3>
              <div className="space-y-2">
                <InfoRow label="Assigned Doctor" value={patient.assigned_doctor_name ? `Dr. ${patient.assigned_doctor_name}` : null} />
                <InfoRow label="Assigned Radiologist" value={patient.assigned_radiologist_name} />
              </div>
            </SectionCard>

            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-teal-600" />
                Associated Hospital
              </h3>
              <div className="space-y-2">
                <InfoRow label="Hospital" value={patient.hospital_name} />
              </div>
            </SectionCard>
          </div>

          <SectionCard className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-indigo-600" />
              Timeline
            </h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No analyses recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {timeline.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                    <div className="p-1.5 rounded-lg bg-white border border-slate-200 shrink-0">
                      {s.modality === 'eeg' ? (
                        <Waves className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Brain className="h-4 w-4 text-teal-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        <span className="uppercase">{s.modality}</span> · {s.analysis_type}
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard id="reports" className="p-5 scroll-mt-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4 text-teal-600" />
              MRI History
            </h3>
            <SessionsTable
              sessions={patient.mri_sessions}
              accent="indigo"
              showPatientColumn={false}
              showDeleteAction={false}
              emptyLabel="No MRI analyses yet."
            />
          </SectionCard>

          <SectionCard className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Waves className="h-4 w-4 text-blue-500" />
              EEG History
            </h3>
            <SessionsTable
              sessions={patient.eeg_sessions}
              accent="indigo"
              showPatientColumn={false}
              showDeleteAction={false}
              emptyLabel="No EEG analyses yet."
            />
          </SectionCard>
        </>
      ) : null}
    </>
  );
}

function PatientProfilePage() {
  return (
    <RoleShell>
      <PatientProfilePageInner />
    </RoleShell>
  );
}

export default withAuth(PatientProfilePage, { allowedRoles: ['super_admin'] });
