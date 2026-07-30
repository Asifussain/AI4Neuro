'use client';

import { Suspense } from 'react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { SessionsListView } from '@/components/dashboards/shared/SessionsListView';
import { withAuth } from '@/lib/withAuth';

function RadiologistSessionsPage() {
  return (
    <RoleShell>
      <Suspense fallback={<div className="h-40" />}>
        <SessionsListView role="radiologist" />
      </Suspense>
    </RoleShell>
  );
}

export default withAuth(RadiologistSessionsPage, { allowedRoles: ['radiologist', 'admin'] });
