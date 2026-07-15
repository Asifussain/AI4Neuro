'use client';

import { AnalysisDashboard } from '@/features/analysis/components/AnalysisDashboard';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { withAuth } from '@/lib/withAuth';

function DoctorDashboardPage() {
  return (
    <RoleShell>
      <AnalysisDashboard />
    </RoleShell>
  );
}

// Protect route - only doctors can access
export default withAuth(DoctorDashboardPage, { allowedRoles: ['doctor'] });
