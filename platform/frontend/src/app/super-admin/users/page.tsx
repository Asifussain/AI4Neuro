'use client';

import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { UserDirectory } from '@/components/dashboards/shared/UserDirectory';
import { withAuth } from '@/lib/withAuth';

function UsersPage() {
  return (
    <RoleShell>
      <UserDirectory
        eyebrow="Super Admin"
        basePath="/super-admin/users"
        accent="indigo"
        fallbackDescription="Complete user directory across every hospital on the platform."
      />
    </RoleShell>
  );
}

export default withAuth(UsersPage, { allowedRoles: ['super_admin'] });
