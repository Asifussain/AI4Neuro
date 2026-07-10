/**
 * Unified backend API client.
 *
 * Talks to the FastAPI backend (NEXT_PUBLIC_API_BASE_URL), attaching the Supabase
 * access token as a Bearer header (doc 14.2). This is the single path the frontend
 * uses for sensitive analysis data — no direct-to-Supabase reads of results.
 */

import { createClient } from '@/lib/supabase/client';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8000';

export interface ApiErrorShape {
  code: string;
  message: string;
  request_id?: string | null;
}

/** Error carrying the backend's structured { error: { code, message } } shape. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let code = 'http_error';
    let message = res.statusText || 'Request failed';
    try {
      const body = (await res.json()) as { error?: ApiErrorShape };
      if (body?.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
      }
    } catch {
      // non-JSON error body; keep defaults
    }
    throw new ApiError(res.status, code, message);
  }
  // 204 / empty body tolerance
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const headers = await authHeaders();
    return parse<T>(await fetch(`${API_BASE}${path}`, { headers, cache: 'no-store' }));
  },

  /** POST JSON or multipart FormData (auto-detected). */
  async post<T>(path: string, body?: FormData | Record<string, unknown>): Promise<T> {
    const headers = await authHeaders();
    const init: RequestInit = { method: 'POST', headers };
    if (body instanceof FormData) {
      init.body = body; // browser sets multipart boundary
    } else if (body !== undefined) {
      init.headers = { ...headers, 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    return parse<T>(await fetch(`${API_BASE}${path}`, init));
  },
};

export { API_BASE };
