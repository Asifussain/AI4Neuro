'use client';

import { HospitalAdminDashboard } from '@/components/dashboards/HospitalAdminDashboard';
import { withAuth } from '@/lib/withAuth';

function HospitalAdminDashboardPage() {
  return <HospitalAdminDashboard />;
}

// Protect route - only the hospital's own admin can access
export default withAuth(HospitalAdminDashboardPage, { allowedRoles: ['admin'] });
