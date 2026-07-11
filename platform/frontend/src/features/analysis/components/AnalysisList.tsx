'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import { analysisApi } from '../api';
import type { SessionStatusResponse } from '../types';

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'failed' || status === 'cancelled') return 'destructive';
  if (status === 'completed') return 'default';
  return 'secondary';
}

/** Role-scoped list of the caller's analyses, fetched from the unified API. */
export function AnalysisList({
  mine = false,
  modality,
  limit = 50,
}: {
  mine?: boolean;
  modality?: string;
  limit?: number;
}) {
  const [items, setItems] = useState<SessionStatusResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    analysisApi
      .list({ mine, modality, limit })
      .then((data) => !cancelled && setItems(data))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [mine, modality, limit]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!items) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (items.length === 0)
    return <p className="text-muted-foreground text-sm">No {modality ? modality.toUpperCase() : ''} analyses yet.</p>;

  return (
    <div className="space-y-3">
      {items.map((s) => (
        <Link key={s.id} href={`/analysis/${s.id}`} className="block">
          <Card className="border-border/80 shadow-none transition-colors hover:border-primary/40 hover:bg-secondary/50">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  <Badge variant="outline" className="uppercase">
                    {s.modality}
                  </Badge>
                  <span className="truncate">{s.analysis_type}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {s.current_stage ? `${s.current_stage} · ` : ''}
                  {s.created_at ? new Date(s.created_at).toLocaleString() : ''}
                </div>
              </div>
              <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
