'use client';

import dynamic from 'next/dynamic';
import { Navbar } from '@/components/shared/Navbar';
import { withAuth } from '@/lib/withAuth';
import { DashboardLoader } from '@/components/ui/LoadingScreen';

// Dynamic import for code splitting
const PatientDashboard = dynamic(
  () => import('@/components/dashboards/PatientDashboard').then(mod => mod.PatientDashboard),
  {
    loading: () => <DashboardLoader role="patient dashboard" />,
    ssr: false,
  }
);

function PatientDashboardPage() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-24">
        <PatientDashboard />
      </div>
    </>
  );
}

// Protect route - only patients can access
export default withAuth(PatientDashboardPage, { allowedRoles: ['patient'] });
