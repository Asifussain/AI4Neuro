'use client';

import { SuperAdminDashboard } from '@/components/dashboards/SuperAdminDashboard';
import { withAuth } from '@/lib/withAuth';

function SuperAdminDashboardPage() {
  return <SuperAdminDashboard />;
}

export default withAuth(SuperAdminDashboardPage, { allowedRoles: ['super_admin'] });
