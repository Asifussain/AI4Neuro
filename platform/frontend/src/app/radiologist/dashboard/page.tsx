'use client';

import dynamic from 'next/dynamic';
import { Navbar } from '@/components/shared/Navbar';
import { withAuth } from '@/lib/withAuth';
import { DashboardLoader } from '@/components/ui/LoadingScreen';

// Dynamic import for code splitting
const RadiologistDashboard = dynamic(
  () => import('@/components/dashboards/RadiologistDashboard').then(mod => mod.RadiologistDashboard),
  {
    loading: () => <DashboardLoader role="radiologist dashboard" />,
    ssr: false,
  }
);

function RadiologistDashboardPage() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-24">
        <RadiologistDashboard />
      </div>
    </>
  );
}

// Protect route - only radiologists can access
export default withAuth(RadiologistDashboardPage, { allowedRoles: ['radiologist'] });
