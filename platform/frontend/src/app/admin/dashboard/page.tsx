'use client';

import { Navbar } from '@/components/shared/Navbar';
import { UnifiedDashboard } from '@/features/analysis/components/UnifiedDashboard';
import { withAuth } from '@/lib/withAuth';

function AdminDashboardPage() {
  return (
    <>
      <Navbar />
      <UnifiedDashboard />
    </>
  );
}

// Protect route - only admins can access
export default withAuth(AdminDashboardPage, { allowedRoles: ['admin'] });
