'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Activity,
  Brain,
  FileText,
  HeartPulse,
  History,
  ShieldCheck,
  Stethoscope,
  Upload,
} from 'lucide-react';

import { useAuth } from '@/components/providers/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Role } from '@/lib/roles';

import { AnalysisList } from './AnalysisList';

const roleCopy: Record<Role, { title: string; description: string }> = {
  admin: {
    title: 'Operations command center',
    description: 'Monitor EEG and MRI analysis activity across your hospital.',
  },
  doctor: {
    title: 'Clinical review workspace',
    description: 'Review assigned patient analyses, reports, and modality-specific findings.',
  },
  radiologist: {
    title: 'Radiology analysis workspace',
    description: 'Start MRI analysis and review imaging outputs from the unified platform.',
  },
  patient: {
    title: 'My neuro-analysis records',
    description: 'View completed analysis reports shared by your care team.',
  },
  super_admin: {
    title: 'Platform command center',
    description: 'Monitor EEG and MRI analysis activity across every hospital.',
  },
};

function FlowCard({
  modality,
  title,
  description,
  points,
  icon,
  action,
}: {
  modality: 'eeg' | 'mri';
  title: string;
  description: string;
  points: string[];
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="ai4-card overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <div>
              <Badge variant="secondary" className="mb-2 uppercase tracking-wide">
                {modality}
              </Badge>
              <CardTitle className="text-lg">{title}</CardTitle>
            </div>
          </div>
        </div>
        <CardDescription className="text-sm leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid gap-2 text-sm text-muted-foreground">
          {points.map((point) => (
            <li key={point} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        {action}
      </CardContent>
    </Card>
  );
}

export function UnifiedDashboard({ embedded = false }: { embedded?: boolean } = {}) {
  const { userProfile } = useAuth();
  const role: Role = userProfile?.role ?? 'doctor';
  const copy = roleCopy[role] ?? roleCopy.doctor;
  const canCreate = role !== 'patient';
  const isRadiologist = role === 'radiologist';

  // `embedded` is used by the redesigned role dashboards, which already provide
  // their own full-page shell (sidebar/topbar) — skip the standalone page
  // background/top spacing that assumes the floating pill Navbar instead.
  const content = (
    <div className={embedded ? 'space-y-8' : 'mx-auto max-w-7xl space-y-8'}>
        <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">AI4NEURO</Badge>
                <Badge variant="outline">Unified EEG + MRI platform</Badge>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  {copy.title}
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                  {copy.description}
                </p>
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Supabase-secured access
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
                  <History className="h-4 w-4 text-primary" />
                  Live status polling
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Role-specific reports
                </div>
              </div>
            </div>
            {canCreate && (
              <Button asChild size="lg" className="h-11">
                <Link href="/analysis/new">
                  <Upload className="mr-2 h-4 w-4" />
                  Start new analysis
                </Link>
              </Button>
            )}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <FlowCard
            modality="eeg"
            title="EEG Alzheimer detection flow"
            description="For brainwave recordings. The backend routes .npy EEG files into the ADFormer/SIDDHI pipeline and returns cognitive-classification outputs."
            icon={<Activity className="h-5 w-5" />}
            points={[
              'Input: 19-channel EEG .npy recording',
              'Models: binary Normal/AD or multiclass CN/MCI/AD',
              'Outputs: trial voting, PSD/time-series plots, similarity, reports',
            ]}
            action={
              canCreate && !isRadiologist ? (
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/analysis/new?modality=eeg">Upload EEG</Link>
                </Button>
              ) : undefined
            }
          />
          <FlowCard
            modality="mri"
            title="MRI neuroimaging analysis flow"
            description="For neuroimaging scans. The backend routes NIfTI MRI files into the CAT12/NIfTI/ConViT-compatible pipeline, with mock mode available for local E2E."
            icon={<Brain className="h-5 w-5" />}
            points={[
              'Input: .nii, .nii.gz, or .gz MRI scan',
              'Models: CN/MCI/AD classification with slice consensus',
              'Outputs: viewer slices, volume charts, confidence, reports',
            ]}
            action={
              canCreate ? (
                <Button asChild variant={isRadiologist ? 'default' : 'outline'} className="w-full sm:w-auto">
                  <Link href="/analysis/new?modality=mri">Upload MRI</Link>
                </Button>
              ) : undefined
            }
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card className="ai4-card">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Recent EEG analyses</CardTitle>
                  <CardDescription>Brainwave sessions available to your role.</CardDescription>
                </div>
                <HeartPulse className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <AnalysisList modality="eeg" limit={6} />
            </CardContent>
          </Card>

          <Card className="ai4-card">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Recent MRI analyses</CardTitle>
                  <CardDescription>Imaging sessions available to your role.</CardDescription>
                </div>
                <Stethoscope className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <AnalysisList modality="mri" limit={6} />
            </CardContent>
          </Card>
        </section>
      </div>
  );

  if (embedded) return content;

  return <main className="ai4-page min-h-screen px-4 pb-12 pt-24">{content}</main>;
}
