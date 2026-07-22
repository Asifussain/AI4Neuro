'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Server-state cache/dedup layer. Foundational adoption: this provider and
 * the query client are wired app-wide, but only AnalysisDashboard has been
 * migrated onto it so far — every other component's hand-rolled fetch+
 * useState pattern is unchanged. Intentionally not a full app-wide
 * migration in one pass; the goal here is to prove the pattern is wired
 * correctly end to end, not to touch every list view at once.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
