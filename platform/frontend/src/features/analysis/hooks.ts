'use client';

import { useCallback, useEffect, useState } from 'react';

import { analysisApi } from './api';
import { isActive } from './types';
import type { AnalysisResultResponse, SessionStatusResponse } from './types';

/**
 * Poll an analysis session until it reaches a terminal state, then fetch the
 * result. Polling stops on completed/failed/cancelled (doc 8.3 / 14.10). Calling
 * `retry` re-arms the polling loop.
 */
export function useAnalysisSession(sessionId: string, intervalMs = 4000) {
  const [status, setStatus] = useState<SessionStatusResponse | null>(null);
  const [result, setResult] = useState<AnalysisResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0); // bump to restart the polling effect

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const s = await analysisApi.status(sessionId);
        if (cancelled) return;
        setStatus(s);
        if (s.status === 'completed') {
          try {
            const r = await analysisApi.result(sessionId);
            if (!cancelled) setResult(r);
          } catch (e) {
            if (!cancelled) setError((e as Error).message);
          }
          return; // terminal
        }
        if (!isActive(s.status)) return; // failed / cancelled
        timer = setTimeout(poll, intervalMs);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        timer = setTimeout(poll, intervalMs * 2); // back off on error
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, intervalMs, nonce]);

  const retry = useCallback(async () => {
    setResult(null);
    setError(null);
    await analysisApi.retry(sessionId);
    setNonce((n) => n + 1); // re-run the polling effect
  }, [sessionId]);

  return { status, result, error, retry };
}
