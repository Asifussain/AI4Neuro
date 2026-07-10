'use client';

import Link from 'next/link';

import { Navbar } from '@/components/shared/Navbar';
import { Button } from '@/components/ui/button';
import { AnalysisList } from '@/features/analysis/components/AnalysisList';
import { withAuth } from '@/lib/withAuth';

/** Unified analyses dashboard — data comes from the backend, role-scoped. */
function DashboardPage() {
  return (
    <>
      <Navbar />
      <div className="bg-background min-h-screen px-4 pt-24">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Analyses</h1>
            <Button asChild>
              <Link href="/analysis/new">New analysis</Link>
            </Button>
          </div>
          <AnalysisList />
        </div>
      </div>
    </>
  );
}

export default withAuth(DashboardPage);
