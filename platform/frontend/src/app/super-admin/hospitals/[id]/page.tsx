'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Brain,
  Building2,
  Landmark,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import {
  DashboardPageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { adminApi, type AdminUser, type Hospital } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{value || 'Not provided'}</span>
    </div>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

function HospitalDetailPageInner() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);

  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([adminApi.hospital(id), adminApi.platformUsers({ hospitalId: id, limit: 200 })])
      .then(([h, u]) => {
        if (cancelled) return;
        setHospital(h);
        setUsers(u.items);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const counts = useMemo(() => {
    const all = users ?? [];
    const active = (role: string) => all.filter((u) => u.role === role && u.account_status !== 'deleted');
    return {
      admin: active('admin').length,
      doctor: active('doctor').length,
      radiologist: active('radiologist').length,
      patient: active('patient').length,
      total: all.filter((u) => u.account_status !== 'deleted').length,
    };
  }, [users]);

  const loading = hospital === null && !error;
  const base = `/super-admin/users?hospital=${id}`;

  return (
    <RoleShell>
      <Link
        href="/super-admin/hospitals"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-700 mb-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Hospitals
      </Link>

      <DashboardPageHeader
        eyebrow="Super Admin · Hospital"
        title={hospital?.name ?? (loading ? 'Loading…' : 'Hospital')}
        description="Drill into every account and record that belongs to this hospital."
        accent="indigo"
        timelineSteps={
          hospital
            ? [
                { label: 'Super Admin', href: '/super-admin/dashboard' },
                { label: 'Hospitals', href: '/super-admin/hospitals' },
                { label: hospital.name, active: true },
              ]
            : [
                { label: 'Super Admin', href: '/super-admin/dashboard' },
                { label: 'Hospital', active: true },
              ]
        }
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load hospital: {error}
        </div>
      )}

      {/* Hospital summary */}
      <SectionCard className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-indigo-50 shrink-0">
              <Building2 className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900 truncate">{hospital?.name ?? '—'}</p>
              <p className="text-xs text-slate-500 font-mono">{hospital?.hospital_code ?? ''}</p>
            </div>
          </div>
          {hospital && <StatusBadge status={hospital.status} />}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 mt-4">
          <InfoRow label="Address" value={hospital?.address} />
          <InfoRow label="Email" value={hospital?.email} />
          <InfoRow label="Phone" value={hospital?.phone} />
          <InfoRow label="License" value={hospital?.license_number} />
          <InfoRow label="Established" value={formatDate(hospital?.established_date)} />
          <InfoRow label="Onboarded" value={formatDate(hospital?.created_at)} />
        </div>
      </SectionCard>

      {/* Clickable role breakdown — each routes to this hospital's scoped directory */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Users" value={counts.total} icon={Users} accent="indigo" isLoading={loading} href={base} />
        <StatCard label="Hospital Admins" value={counts.admin} icon={Landmark} accent="indigo" isLoading={loading} href={`${base}&role=admin`} />
        <StatCard label="Doctors" value={counts.doctor} icon={Stethoscope} accent="indigo" isLoading={loading} href={`${base}&role=doctor`} />
        <StatCard label="Radiologists" value={counts.radiologist} icon={Brain} accent="indigo" isLoading={loading} href={`${base}&role=radiologist`} />
        <StatCard label="Patients" value={counts.patient} icon={UserRound} accent="indigo" isLoading={loading} href={`${base}&role=patient`} />
      </div>

      <p className="text-xs text-slate-400">
        Tip: open a role above to see its members in this hospital, then click any person to view their full profile.
      </p>
    </RoleShell>
  );
}

export default withAuth(HospitalDetailPageInner, { allowedRoles: ['super_admin'] });
