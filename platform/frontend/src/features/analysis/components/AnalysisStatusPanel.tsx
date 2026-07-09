'use client';

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
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry analysis
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
