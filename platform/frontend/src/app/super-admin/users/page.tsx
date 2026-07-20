'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { UserDirectory } from '@/components/dashboards/shared/UserDirectory';
import { CreateUserDialog } from '@/components/dashboards/shared/CreateUserDialog';
import { adminApi, type Hospital } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';
import { ROLES, type Role } from '@/lib/roles';

function UsersPageInner() {
  const roleParam = useSearchParams().get('role');
  const role = (ROLES as readonly string[]).includes(roleParam ?? '') ? (roleParam as Role) : null;

  const [createOpen, setCreateOpen] = useState(false);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    adminApi
      .hospitals({ limit: 200 })
      .then((r) => setHospitals(r.items))
      .catch(() => setHospitals([]));
  }, []);

  return (
    <>
      <UserDirectory
        key={refreshKey}
        eyebrow="Super Admin"
        basePath="/super-admin/users"
        accent="indigo"
        fallbackDescription="Complete user directory across every hospital on the platform."
        onAddUser={() => setCreateOpen(true)}
      />

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        allowedRoles={role ? [role] : ['doctor', 'radiologist', 'patient', 'admin', 'super_admin']}
        hospitals={hospitals}
        accent="indigo"
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}

function UsersPage() {
  return (
    <RoleShell>
      <Suspense fallback={<div className="h-40" />}>
        <UsersPageInner />
      </Suspense>
    </RoleShell>
  );
}

export default withAuth(UsersPage, { allowedRoles: ['super_admin'] });
