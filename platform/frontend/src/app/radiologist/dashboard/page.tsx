'use client';

import { AnalysisDashboard } from '@/features/analysis/components/AnalysisDashboard';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { withAuth } from '@/lib/withAuth';

function RadiologistDashboardPage() {
  return (
    <RoleShell>
      <AnalysisDashboard />
    </RoleShell>
  );
}

// Protect route - only radiologists can access
export default withAuth(RadiologistDashboardPage, { allowedRoles: ['radiologist'] });
