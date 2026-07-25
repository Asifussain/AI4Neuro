'use client';

import { useState } from 'react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { UserDirectory } from '@/components/dashboards/shared/UserDirectory';
import { CreateUserDialog } from '@/components/dashboards/shared/CreateUserDialog';
import { withAuth } from '@/lib/withAuth';

function HospitalAdminUsersPage() {
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <RoleShell>
      <UserDirectory
        key={refreshKey}
        eyebrow="Hospital Admin"
        basePath="/admin/users"
        accent="teal"
        fallbackDescription="Complete user directory for your hospital."
        onAddUser={() => setIsCreateUserOpen(true)}
      />
      <CreateUserDialog
        open={isCreateUserOpen}
        onOpenChange={setIsCreateUserOpen}
        allowedRoles={['doctor', 'radiologist', 'patient']}
        hideHospitalPicker
        accent="teal"
        onCreated={() => setRefreshKey((prev) => prev + 1)}
      />
    </RoleShell>
  );
}

export default withAuth(HospitalAdminUsersPage, { allowedRoles: ['admin'] });
