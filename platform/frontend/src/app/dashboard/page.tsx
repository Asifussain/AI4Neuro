'use client';

import { Navbar } from '@/components/shared/Navbar';
import { UnifiedDashboard } from '@/features/analysis/components/UnifiedDashboard';
import { withAuth } from '@/lib/withAuth';

function DashboardPage() {
  return (
    <>
      <Navbar />
      <UnifiedDashboard />
    </>
  );
}

export default withAuth(DashboardPage);
