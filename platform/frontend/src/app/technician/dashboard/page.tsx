'use client';

import { Navbar } from '@/components/shared/Navbar';
import { UnifiedDashboard } from '@/features/analysis/components/UnifiedDashboard';
import { withAuth } from '@/lib/withAuth';

function TechnicianDashboardPage() {
  return (
    <>
      <Navbar />
      <UnifiedDashboard />
    </>
  );
}

export default withAuth(TechnicianDashboardPage, { allowedRoles: ['technician', 'admin'] });
