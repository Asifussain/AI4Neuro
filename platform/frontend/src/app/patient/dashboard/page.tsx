'use client';

import { AnalysisDashboard } from '@/features/analysis/components/AnalysisDashboard';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { withAuth } from '@/lib/withAuth';

function PatientDashboardPage() {
  return (
    <RoleShell>
      <AnalysisDashboard />
    </RoleShell>
  );
}

// Protect route - only patients can access
export default withAuth(PatientDashboardPage, { allowedRoles: ['patient'] });
