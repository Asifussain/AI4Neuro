'use client';

import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { MRISessionViewer } from '@/components/viewers/MRISessionViewer';
import { use } from 'react';

export default function RadiologistViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleShell>
      <MRISessionViewer role="radiologist" sessionId={id} />
    </RoleShell>
  );
}
