'use client';

import dynamic from 'next/dynamic';
import { Navbar } from '@/components/shared/Navbar';
import { withAuth } from '@/lib/withAuth';
import { DashboardLoader } from '@/components/ui/LoadingScreen';

// Dynamic import for code splitting
const DoctorDashboard = dynamic(
  () => import('@/components/dashboards/DoctorDashboard').then(mod => mod.DoctorDashboard),
  {
    loading: () => <DashboardLoader role="doctor dashboard" />,
    ssr: false,
  }
);

function DoctorDashboardPage() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-24">
        <DoctorDashboard />
      </div>
    </>
  );
}

// Protect route - only doctors can access
export default withAuth(DoctorDashboardPage, { allowedRoles: ['doctor'] });
