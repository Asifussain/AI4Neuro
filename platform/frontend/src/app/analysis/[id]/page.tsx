'use client';

import { useParams } from 'next/navigation';

import { Navbar } from '@/components/shared/Navbar';
import { AnalysisResultPanel } from '@/features/analysis/components/AnalysisResultPanel';
import { AnalysisStatusPanel } from '@/features/analysis/components/AnalysisStatusPanel';
import { useAnalysisSession } from '@/features/analysis/hooks';
import { withAuth } from '@/lib/withAuth';

function AnalysisDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const { status, result, retry } = useAnalysisSession(id);

  return (
    <>
      <Navbar />
      <div className="ai4-page min-h-screen px-4 pb-12 pt-24">
        <div className="mx-auto max-w-5xl space-y-4">
          <AnalysisStatusPanel status={status} onRetry={retry} />
          {result && <AnalysisResultPanel result={result} />}
        </div>
      </div>
    </>
  );
}

// Any authenticated user; the backend enforces per-session read access.
export default withAuth(AnalysisDetailPage);
