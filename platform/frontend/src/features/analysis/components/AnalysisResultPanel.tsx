'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';

import { useAuth } from '@/components/providers/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { AnalysisResultResponse } from '../types';

// Heavy viewers — client-only, loaded on demand.
const RealMRIViewer = dynamic(
  () => import('@/components/viewers/RealMRIViewer').then((m) => m.RealMRIViewer),
  { ssr: false },
);
const MockMRIViewer = dynamic(
  () => import('@/components/viewers/MockMRIViewer').then((m) => m.MockMRIViewer),
  { ssr: false },
);

type ViewerMode = 'patient' | 'doctor' | 'radiologist';
type DiseaseClass = 'CN' | 'MCI' | 'AD';

function toViewerMode(role: string | undefined): ViewerMode {
  return role === 'patient' || role === 'radiologist' ? role : 'doctor';
}

function urlOf(viz: Record<string, unknown>, key: string): string | null {
  const v = viz[key];
  return typeof v === 'string' ? v : null;
}

function ProbabilityBars({ probs }: { probs: Record<string, number> }) {
  const entries = Object.entries(probs);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      {entries.map(([label, p]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{label}</span>
            <span className="text-muted-foreground">{(p * 100).toFixed(1)}%</span>
          </div>
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, p * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PlotImage({ src, alt }: { src: string; alt: string }) {
  // Signed URLs from private buckets; unoptimized to skip the Next image loader.
  return (
    <div className="overflow-hidden rounded-md border">
      <Image src={src} alt={alt} width={800} height={480} unoptimized className="h-auto w-full" />
    </div>
  );
}

export function AnalysisResultPanel({ result }: { result: AnalysisResultResponse }) {
  const { userProfile } = useAuth();
  const viz = result.visualizations ?? {};
  const isEeg = result.modality === 'eeg';

  const viewerMode = toViewerMode(userProfile?.role);
  const mriPrediction = (['CN', 'MCI', 'AD'] as const).find((p) => p === result.prediction) as
    | DiseaseClass
    | undefined;
  const sliceUrls = (viz.viewer_slice_urls ?? null) as
    | { axial?: string[]; sagittal?: string[]; coronal?: string[] }
    | null;
  const hasSlices = !!(
    sliceUrls &&
    ((sliceUrls.axial?.length ?? 0) > 0 ||
      (sliceUrls.sagittal?.length ?? 0) > 0 ||
      (sliceUrls.coronal?.length ?? 0) > 0)
  );

  const eegPlots = [
    ['Time series', urlOf(viz, 'timeseries_plot_url')],
    ['Power spectral density', urlOf(viz, 'psd_plot_url')],
    ['Channel similarity', urlOf(viz, 'similarity_plot_url')],
  ] as const;

  const mriCharts = [
    ['Brain volume comparison', urlOf(viz, 'volume_chart_url')],
    ['Confidence distribution', urlOf(viz, 'confidence_chart_url')],
  ] as const;

  const reports = [
    ['Patient', result.report_urls?.patient],
    ['Clinician', result.report_urls?.clinician],
    ['Technical', result.report_urls?.technical],
  ] as const;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Result</CardTitle>
          <Badge>{result.model_version ?? 'model'}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{result.prediction}</span>
            {result.confidence != null && (
              <span className="text-muted-foreground">
                {(result.confidence * 100).toFixed(1)}% confidence
              </span>
            )}
          </div>
          <ProbabilityBars probs={result.probabilities} />
        </CardContent>
      </Card>

      {(isEeg ? eegPlots : mriCharts).some(([, url]) => url) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isEeg ? 'EEG visualizations' : 'MRI visualizations'}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {(isEeg ? eegPlots : mriCharts).map(
              ([label, url]) => url && <PlotImage key={label} src={url} alt={label} />,
            )}
          </CardContent>
        </Card>
      )}

      {result.modality === 'mri' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">MRI viewer</CardTitle>
          </CardHeader>
          <CardContent>
            {hasSlices ? (
              <RealMRIViewer
                sessionId={result.session_id}
                sliceUrls={{
                  axial: sliceUrls?.axial ?? [],
                  sagittal: sliceUrls?.sagittal ?? [],
                  coronal: sliceUrls?.coronal ?? [],
                }}
                viewerMode={viewerMode}
                prediction={mriPrediction}
                confidence={result.confidence ?? undefined}
              />
            ) : (
              <MockMRIViewer
                sessionId={result.session_id}
                viewerMode={viewerMode}
                prediction={mriPrediction}
              />
            )}
          </CardContent>
        </Card>
      )}

      {reports.some(([, url]) => url) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reports</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {reports.map(([label, url]) =>
              url ? (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm underline"
                >
                  {label} report (PDF)
                </a>
              ) : null,
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
