'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Client-side data cache (the frontend equivalent of the backend's
 * cachetools TTL cache). Without this, every component mount re-fetches
 * everything from scratch even when the same data was just loaded a moment
 * ago on another page - staleTime keeps a query result usable for a while
 * before it's silently refetched in the background.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // matches the backend's 30s TTL cache
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
