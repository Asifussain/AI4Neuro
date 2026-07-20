'use client';

import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { UserDirectory } from '@/components/dashboards/shared/UserDirectory';
import { CreateUserDialog } from '@/components/dashboards/shared/CreateUserDialog';
import { Button } from '@/components/ui/button';
import { adminApi, type Hospital } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

function UsersPage() {
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
    <RoleShell>
      <div className="flex justify-end">
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <UserDirectory
        key={refreshKey}
        eyebrow="Super Admin"
        basePath="/super-admin/users"
        accent="indigo"
        fallbackDescription="Complete user directory across every hospital on the platform."
      />

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        allowedRoles={['doctor', 'radiologist', 'patient', 'admin', 'super_admin']}
        hospitals={hospitals}
        accent="indigo"
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </RoleShell>
  );
}

export default withAuth(UsersPage, { allowedRoles: ['super_admin'] });
