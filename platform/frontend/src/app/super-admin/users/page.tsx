'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import {
  SectionCard,
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { adminApi, type AdminUser } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

const ROLE_TITLES: Record<string, { title: string; description: string }> = {
  doctor: { title: 'Doctors', description: 'All doctors across every hospital on the platform.' },
  radiologist: { title: 'Radiologists', description: 'All radiologists across every hospital on the platform.' },
  patient: { title: 'Patients', description: 'All patients registered across every hospital.' },
  hospital_admin: { title: 'Hospital Admins', description: 'All hospital administrators across the platform.' },
  super_admin: { title: 'Super Admins', description: 'Platform-level super administrators.' },
};

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function UsersInner({ role }: { role?: string }) {
  const meta = role ? ROLE_TITLES[role] : undefined;

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminApi
      .users(role)
      .then((u) => !cancelled && setUsers(u))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [role]);

  const filtered = useMemo(() => {
    const all = users ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (u) =>
        u.full_name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.unique_identifier.toLowerCase().includes(term)
    );
  }, [users, q]);

  const loading = users === null && !error;

  return (
    <>
      <DashboardPageHeader
        eyebrow="Super Admin"
        title={meta?.title ?? 'All Users'}
        description={meta?.description ?? 'Complete user directory across every hospital on the platform.'}
        routeChip={`/super-admin/users${role ? `?role=${role}` : ''}`}
        accent="indigo"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load users: {error}
        </div>
      )}

      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
          </p>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email or ID…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Users className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2.5 pr-4 font-medium">Name</th>
                  <th className="py-2.5 pr-4 font-medium hidden md:table-cell">Email</th>
                  {!role && <th className="py-2.5 pr-4 font-medium">Role</th>}
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                          {initials(u.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{u.full_name}</p>
                          <p className="text-xs text-slate-400 font-mono truncate md:hidden">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell text-slate-600 truncate">{u.email}</td>
                    {!role && (
                      <td className="py-3 pr-4 capitalize text-slate-600">{u.role.replace(/_/g, ' ')}</td>
                    )}
                    <td className="py-3 pr-4">
                      <StatusBadge status={u.account_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

function UsersResolver() {
  const role = useSearchParams().get('role') || undefined;
  // Keying by role remounts the inner view on filter change, giving a clean
  // loading state without synchronously resetting state inside an effect.
  return <UsersInner key={role ?? 'all'} role={role} />;
}

function UsersPage() {
  return (
    <RoleShell>
      <Suspense fallback={<div className="h-40" />}>
        <UsersResolver />
      </Suspense>
    </RoleShell>
  );
}

export default withAuth(UsersPage, { allowedRoles: ['super_admin'] });
