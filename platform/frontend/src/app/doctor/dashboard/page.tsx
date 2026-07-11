'use client';

import { Navbar } from '@/components/shared/Navbar';
import { UnifiedDashboard } from '@/features/analysis/components/UnifiedDashboard';
import { withAuth } from '@/lib/withAuth';

function DoctorDashboardPage() {
  return (
    <>
      <Navbar />
      <UnifiedDashboard />
    </>
  );
}

// Protect route - only doctors can access
export default withAuth(DoctorDashboardPage, { allowedRoles: ['doctor'] });
