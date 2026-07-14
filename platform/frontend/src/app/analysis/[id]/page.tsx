'use client';

import { useParams } from 'next/navigation';

import { AnalysisResultPanel } from '@/features/analysis/components/AnalysisResultPanel';
import { AnalysisStatusPanel } from '@/features/analysis/components/AnalysisStatusPanel';
import { useAnalysisSession } from '@/features/analysis/hooks';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { withAuth } from '@/lib/withAuth';

function AnalysisDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const { status, result, retry } = useAnalysisSession(id);

  return (
    <RoleShell>
      <div className="mx-auto max-w-5xl space-y-4 py-2">
        <AnalysisStatusPanel status={status} onRetry={retry} />
        {result && <AnalysisResultPanel result={result} />}
      </div>
    </RoleShell>
  );
}

// Any authenticated user; the backend enforces per-session read access.
export default withAuth(AnalysisDetailPage);
