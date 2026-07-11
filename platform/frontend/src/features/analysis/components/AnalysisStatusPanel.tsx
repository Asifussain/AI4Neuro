'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import type { SessionStatusResponse } from '../types';

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'failed' || status === 'cancelled') return 'destructive';
  if (status === 'completed') return 'default';
  return 'secondary';
}

function changeRetryHref(status: SessionStatusResponse): string {
  const params = new URLSearchParams({
    modality: status.modality,
    analysis_type: status.analysis_type,
    retry_from: status.id,
  });
  if (status.patient_id) params.set('patient_id', status.patient_id);
  if (status.doctor_id) params.set('doctor_id', status.doctor_id);
  return `/analysis/new?${params.toString()}`;
}

export function AnalysisStatusPanel({
  status,
  onRetry,
}: {
  status: SessionStatusResponse | null;
  onRetry?: () => void;
}) {
  if (!status) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading session…
        </CardContent>
      </Card>
    );
  }

  const failed = status.status === 'failed' || status.status === 'cancelled';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {status.modality.toUpperCase()} · {status.analysis_type}
        </CardTitle>
        <Badge variant={statusVariant(status.status)}>{status.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={status.progress_percent} />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{status.current_stage ?? 'Waiting…'}</span>
          <span>{status.progress_percent}%</span>
        </div>
        {failed && (
          <div className="space-y-3">
            <p className="text-destructive text-sm">
              {status.error_message ?? 'Analysis did not complete.'}
            </p>
            {onRetry && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry same settings
                </Button>
                <Button asChild size="sm">
                  <Link href={changeRetryHref(status)}>Change file or type</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
