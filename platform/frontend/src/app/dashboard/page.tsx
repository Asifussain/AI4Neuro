'use client';

import { UnifiedDashboard } from '@/features/analysis/components/UnifiedDashboard';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { withAuth } from '@/lib/withAuth';

function DashboardPage() {
  return (
    <RoleShell>
      <UnifiedDashboard embedded />
    </RoleShell>
  );
}

export default withAuth(DashboardPage);
