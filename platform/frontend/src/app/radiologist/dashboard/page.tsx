'use client';

import { Navbar } from '@/components/shared/Navbar';
import { UnifiedDashboard } from '@/features/analysis/components/UnifiedDashboard';
import { withAuth } from '@/lib/withAuth';

function RadiologistDashboardPage() {
  return (
    <>
      <Navbar />
      <UnifiedDashboard />
    </>
  );
}

// Protect route - only radiologists can access
export default withAuth(RadiologistDashboardPage, { allowedRoles: ['radiologist'] });
