'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { withAuth } from '@/lib/withAuth';

function RadiologistUploadPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/analysis/new?modality=mri');
  }, [router]);

  return (
    <LoadingScreen
      message="Opening MRI upload"
      submessage="Taking you to the unified AI4NEURO analysis flow..."
    />
  );
}

export default withAuth(RadiologistUploadPage, { allowedRoles: ['radiologist', 'hospital_admin', 'super_admin'] });
