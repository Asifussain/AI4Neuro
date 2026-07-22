import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAnalysisSession } from './hooks';
import { analysisApi } from './api';

vi.mock('./api', () => ({
  analysisApi: {
    status: vi.fn(),
    result: vi.fn(),
    retry: vi.fn(),
  },
}));

const mockedStatus = analysisApi.status as ReturnType<typeof vi.fn>;
const mockedResult = analysisApi.result as ReturnType<typeof vi.fn>;

function statusResponse(status: string) {
  return { session_id: 's1', status, progress_percent: 0 } as never;
}

describe('useAnalysisSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches the result and stops polling once the session completes', async () => {
    mockedStatus.mockResolvedValue(statusResponse('completed'));
    mockedResult.mockResolvedValue({ session_id: 's1', prediction: 'CN' } as never);

    const { result } = renderHook(() => useAnalysisSession('s1', 1000));

    await waitFor(() => expect(result.current.status?.status).toBe('completed'));
    await waitFor(() => expect(result.current.result?.prediction).toBe('CN'));

    expect(mockedStatus).toHaveBeenCalledTimes(1);
  });

  it('keeps polling on an active status until it reaches a terminal one', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedStatus.mockResolvedValue(statusResponse('processing'));

    renderHook(() => useAnalysisSession('s1', 1000));

    await vi.waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockedStatus).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockedStatus).toHaveBeenCalledTimes(3);
  });

  it('stops polling on a terminal failed status without fetching a result', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedStatus.mockResolvedValue(statusResponse('failed'));

    renderHook(() => useAnalysisSession('s1', 1000));

    await vi.waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(5000);

    expect(mockedStatus).toHaveBeenCalledTimes(1);
    expect(mockedResult).not.toHaveBeenCalled();
  });

  it('surfaces an error and backs off (2x interval) before retrying', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedStatus.mockRejectedValueOnce(new Error('network down'));
    mockedStatus.mockResolvedValueOnce(statusResponse('processing'));

    const { result } = renderHook(() => useAnalysisSession('s1', 1000));

    await vi.waitFor(() => expect(result.current.error).toBe('network down'));
    expect(mockedStatus).toHaveBeenCalledTimes(1);

    // Backed-off retry is at 2x the interval — not yet due at 1x.
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockedStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockedStatus).toHaveBeenCalledTimes(2);
  });
});
