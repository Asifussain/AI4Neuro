'use client';

import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { UserDirectory } from '@/components/dashboards/shared/UserDirectory';
import { withAuth } from '@/lib/withAuth';

function HospitalAdminUsersPage() {
  return (
    <RoleShell>
      <UserDirectory
        eyebrow="Hospital Admin"
        basePath="/admin/users"
        accent="teal"
        fallbackDescription="Complete user directory for your hospital."
      />
    </RoleShell>
  );
}

export default withAuth(HospitalAdminUsersPage, { allowedRoles: ['admin'] });
