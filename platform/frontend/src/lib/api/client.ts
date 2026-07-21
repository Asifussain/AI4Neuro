/**
 * Unified backend API client.
 *
 * Talks to the FastAPI backend (NEXT_PUBLIC_API_BASE_URL), attaching the Supabase
 * access token as a Bearer header (doc 14.2). This is the single path the frontend
 * uses for sensitive analysis data — no direct-to-Supabase reads of results.
 */

import { createClient } from '@/lib/supabase/client';

// NEXT_PUBLIC_API_BASE_URL is inlined at build time and, when unset, has
// silently defaulted to localhost:8000 on every deployed environment
// (Vercel, staging, ...) where the frontend and backend obviously aren't on
// the same machine — surfacing as "Cannot reach the API server at
// http://localhost:8000" on every CRUD action. If the build genuinely didn't
// get the env var AND we're not actually running locally, fall back to the
// documented production backend (see docs/PRODUCTION_HOSTING_DNS_REFERENCE.md)
// instead of a URL that can never work outside a developer's machine. Setting
// NEXT_PUBLIC_API_BASE_URL explicitly always wins over this fallback.
function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  if (configured) return configured;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    if (!isLocal) return 'https://api.ai4neuro.in';
  }

  return 'http://localhost:8000';
}

const API_BASE = resolveApiBase();

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

/** fetch() wrapper that turns a network failure (backend down / wrong URL /
 * CORS) into a clear, actionable ApiError instead of the opaque
 * "Failed to fetch" the browser surfaces. */
async function doFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(
      0,
      'network_error',
      `Cannot reach the API server at ${API_BASE}. Is the backend running, and is NEXT_PUBLIC_API_BASE_URL set correctly?`
    );
  }
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const headers = await authHeaders();
    return parse<T>(await doFetch(path, { headers, cache: 'no-store' }));
  },

  /** POST JSON or multipart FormData (auto-detected). */
  async post<T>(path: string, body?: FormData | object): Promise<T> {
    const headers = await authHeaders();
    const init: RequestInit = { method: 'POST', headers };
    if (body instanceof FormData) {
      init.body = body; // browser sets multipart boundary
    } else if (body !== undefined) {
      init.headers = { ...headers, 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    return parse<T>(await doFetch(path, init));
  },

  /** PATCH JSON. */
  async patch<T>(path: string, body?: object): Promise<T> {
    const headers = await authHeaders();
    const init: RequestInit = { method: 'PATCH', headers };
    if (body !== undefined) {
      init.headers = { ...headers, 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    return parse<T>(await doFetch(path, init));
  },

  /** DELETE. Tolerates a 204 No Content response. */
  async delete<T>(path: string): Promise<T> {
    const headers = await authHeaders();
    return parse<T>(await doFetch(path, { method: 'DELETE', headers }));
  },
};

export { API_BASE };
