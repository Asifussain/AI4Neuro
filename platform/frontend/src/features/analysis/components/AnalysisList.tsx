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
export function AnalysisList({ mine = false, modality }: { mine?: boolean; modality?: string }) {
  const [items, setItems] = useState<SessionStatusResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    analysisApi
      .list({ mine, modality, limit: 50 })
      .then((data) => !cancelled && setItems(data))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [mine, modality]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!items) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (items.length === 0)
    return <p className="text-muted-foreground text-sm">No analyses yet.</p>;

  return (
    <div className="space-y-2">
      {items.map((s) => (
        <Link key={s.id} href={`/analysis/${s.id}`} className="block">
          <Card className="hover:bg-accent transition-colors">
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">
                  {s.modality.toUpperCase()} · {s.analysis_type}
                </div>
                <div className="text-muted-foreground text-xs">{s.created_at ?? ''}</div>
              </div>
              <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
